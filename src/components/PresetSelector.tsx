import React from 'react';
import { Database, Sparkles, ShoppingBag, Layers, BookOpen } from 'lucide-react';

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  code: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'Models for Users, Profiles, Posts, Categories, Comments, and Roles.',
    icon: <BookOpen size={16} />,
    code: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// User accounts with profiles and multiple articles
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  profile   Profile?
  posts     Post[]
  comments  Comment[]
  createdAt DateTime @default(now())
}

/// Profile containing biography details for a user
model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  userId Int    @unique
  user   User   @relation(fields: [userId], references: [id])
}

/// Articles published by users, categorised with tags
model Post {
  id         Int        @id @default(autoincrement())
  title      String
  content    String?
  published  Boolean    @default(false)
  authorId   Int
  author     User       @relation(fields: [authorId], references: [id])
  comments   Comment[]
  categories Category[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

/// Comments written by users on posts
model Comment {
  id        Int      @id @default(autoincrement())
  text      String
  postId    Int
  post      Post     @relation(fields: [postId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}

/// Many-to-many categories categorising posts
model Category {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}

/// User access control levels
enum Role {
  USER
  ADMIN
  MODERATOR
}`,
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce SaaS',
    description: 'Store database with Users, Products, Categories, Orders, Payments, and Reviews.',
    icon: <ShoppingBag size={16} />,
    code: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id        String   @id @default(uuid())
  email     String   @unique
  firstName String
  lastName  String
  orders    Order[]
  reviews   Review[]
  createdAt DateTime @default(now())
}

model Product {
  id          String      @id @default(uuid())
  name        String
  description String
  price       Decimal
  stock       Int
  categoryId  String
  category    Category    @relation(fields: [categoryId], references: [id])
  orderItems  OrderItem[]
  reviews     Review[]
  createdAt   DateTime    @default(now())
}

model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Order {
  id         String      @id @default(uuid())
  customerId String
  customer   Customer    @relation(fields: [customerId], references: [id])
  items      OrderItem[]
  status     OrderStatus @default(PENDING)
  total      Decimal
  payment    Payment?
  createdAt  DateTime    @default(now())
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  price     Decimal
}

model Payment {
  id            String        @id @default(uuid())
  orderId       String        @unique
  order         Order         @relation(fields: [orderId], references: [id])
  amount        Decimal
  method        PaymentMethod
  status        PaymentStatus @default(PENDING)
  transactionId String?
  createdAt     DateTime      @default(now())
}

model Review {
  id         String   @id @default(uuid())
  rating     Int
  comment    String?
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  createdAt  DateTime @default(now())
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  CREDIT_CARD
  PAYPAL
  STRIPE
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  SUCCESSFUL
  FAILED
  REFUNDED
}`,
  },
  {
    id: 'saas',
    name: 'SaaS Workspace',
    description: 'Workspaces, Membership settings, Projects, Tasks, and Comments.',
    icon: <Layers size={16} />,
    code: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id          String       @id @default(cuid())
  name        String
  memberships Membership[]
  createdTasks Task[]      @relation("CreatedTasks")
  assignedTasks Task[]     @relation("AssignedTasks")
}

model Workspace {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  memberships Membership[]
  projects    Project[]
  createdAt   DateTime     @default(now())
}

model Membership {
  id          String    @id @default(cuid())
  role        WorkspaceRole @default(MEMBER)
  accountId   String
  account     Account   @relation(fields: [accountId], references: [id])
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  createdAt   DateTime  @default(now())

  @@unique([accountId, workspaceId])
}

model Project {
  id          String    @id @default(cuid())
  name        String
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  tasks       Task[]
  createdAt   DateTime  @default(now())
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(BACKLOG)
  priority    Priority   @default(MEDIUM)
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id])
  creatorId   String
  creator     Account    @relation("CreatedTasks", fields: [creatorId], references: [id])
  assigneeId  String?
  assignee    Account?   @relation("AssignedTasks", fields: [assigneeId], references: [id])
  dueDate     DateTime?
  createdAt   DateTime   @default(now())
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}`,
  },
];

interface PresetSelectorProps {
  onSelectPreset: (code: string) => void;
  activePresetId: string | null;
  setActivePresetId: (id: string | null) => void;
}

export const PresetSelector = ({ onSelectPreset, activePresetId, setActivePresetId }: PresetSelectorProps) => {
  return (
    <div className="preset-selector-widget">
      <div className="preset-header">
        <Sparkles size={14} className="preset-header-icon" />
        <span>Try Schema Presets</span>
      </div>
      <div className="preset-buttons-grid">
        {PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => {
                onSelectPreset(preset.code);
                setActivePresetId(preset.id);
              }}
              className={`preset-card-btn ${isActive ? 'active' : ''}`}
            >
              <div className="preset-card-icon">{preset.icon}</div>
              <div className="preset-card-text">
                <div className="preset-card-name">{preset.name}</div>
                <div className="preset-card-desc">{preset.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
