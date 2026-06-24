export interface PrismaField {
  name: string;
  type: string;
  isId: boolean;
  isUnique: boolean;
  isOptional: boolean;
  isList: boolean;
  isRelation: boolean;
  relationFields?: string[];
  relationReferences?: string[];
  relationName?: string;
  documentation?: string;
}

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  documentation?: string;
}

export interface PrismaEnum {
  name: string;
  values: string[];
  documentation?: string;
}

export interface PrismaSchema {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

export function parsePrismaSchema(schemaText: string): PrismaSchema {
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];

  const lines = schemaText.split(/\r?\n/);
  let currentModel: PrismaModel | null = null;
  let currentEnum: PrismaEnum | null = null;
  let accumulatedDocs = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Handle comments & documentation
    if (trimmed.startsWith('///') || trimmed.startsWith('//')) {
      const docContent = trimmed.replace(/^\/+\s*/, '');
      accumulatedDocs = accumulatedDocs 
        ? `${accumulatedDocs}\n${docContent}` 
        : docContent;
      continue;
    }

    if (!trimmed) {
      // Empty line resets documentation if we're not inside a block
      if (!currentModel && !currentEnum) {
        accumulatedDocs = '';
      }
      continue;
    }

    // Check for Model start
    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = {
        name: modelMatch[1],
        fields: [],
        documentation: accumulatedDocs || undefined,
      };
      accumulatedDocs = '';
      continue;
    }

    // Check for Enum start
    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      currentEnum = {
        name: enumMatch[1],
        values: [],
        documentation: accumulatedDocs || undefined,
      };
      accumulatedDocs = '';
      continue;
    }

    // End of block
    if (trimmed === '}') {
      if (currentModel) {
        models.push(currentModel);
        currentModel = null;
      } else if (currentEnum) {
        enums.push(currentEnum);
        currentEnum = null;
      }
      accumulatedDocs = '';
      continue;
    }

    // Process inside Enum
    if (currentEnum) {
      // Enum values are usually just single words
      const valueMatch = trimmed.match(/^(\w+)/);
      if (valueMatch) {
        currentEnum.values.push(valueMatch[1]);
      }
      continue;
    }

    // Process inside Model
    if (currentModel) {
      // Skip model-level attributes like @@index, @@id, etc.
      if (trimmed.startsWith('@@')) {
        continue;
      }

      // Match field: name type attributes
      // e.g. "id Int @id @default(autoincrement())"
      // or "author User? @relation(fields: [authorId], references: [id])"
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0];
        let rawType = parts[1];
        const attributesString = parts.slice(2).join(' ');

        let isOptional = false;
        let isList = false;

        if (rawType.endsWith('?')) {
          isOptional = true;
          rawType = rawType.slice(0, -1);
        } else if (rawType.endsWith('[]')) {
          isList = true;
          rawType = rawType.slice(0, -2);
        }

        const isId = attributesString.includes('@id');
        const isUnique = attributesString.includes('@unique');

        // Parse relation attributes
        let relationFields: string[] | undefined;
        let relationReferences: string[] | undefined;
        let relationName: string | undefined;

        if (attributesString.includes('@relation')) {
          const relRegex = /@relation\(([^)]+)\)/;
          const match = attributesString.match(relRegex);
          if (match) {
            const content = match[1];

            // Extract fields: [f1, f2]
            const fieldsMatch = content.match(/fields\s*:\s*\[([^\]]+)\]/);
            if (fieldsMatch) {
              relationFields = fieldsMatch[1].split(',').map((s) => s.trim());
            }

            // Extract references: [r1, r2]
            const referencesMatch = content.match(/references\s*:\s*\[([^\]]+)\]/);
            if (referencesMatch) {
              relationReferences = referencesMatch[1].split(',').map((s) => s.trim());
            }

            // Extract relation name (either name: "name" or first positional string argument)
            const nameMatch = content.match(/name\s*:\s*["']([^"']+)["']/) || content.match(/^\s*["']([^"']+)["']/);
            if (nameMatch) {
              relationName = nameMatch[1];
            }
          }
        }

        currentModel.fields.push({
          name,
          type: rawType,
          isId,
          isUnique,
          isOptional,
          isList,
          isRelation: false, // Will be set after checking all models
          relationFields,
          relationReferences,
          relationName,
          documentation: accumulatedDocs || undefined,
        });
      }
      accumulatedDocs = '';
    }
  }

  // Determine if a field is a relation (types that match model names)
  const modelNames = new Set(models.map((m) => m.name));
  for (const model of models) {
    for (const field of model.fields) {
      if (modelNames.has(field.type)) {
        field.isRelation = true;
      }
    }
  }

  return { models, enums };
}
