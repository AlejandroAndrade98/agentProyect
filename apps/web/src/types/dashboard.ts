import type { CurrentUser } from './user';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'MEETING_SCHEDULED'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST'
  | 'ARCHIVED';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Source =
  | 'MANUAL'
  | 'AI_SUGGESTION'
  | 'IMPORT'
  | 'EMAIL'
  | 'MEETING'
  | 'OTHER';

export type EntityType =
  | 'COMPANY'
  | 'CONTACT'
  | 'LEAD'
  | 'TASK'
  | 'NOTE'
  | 'PRODUCT'
  | 'USER';

export type ActivityEventType =
  | 'COMPANY_CREATED'
  | 'CONTACT_CREATED'
  | 'LEAD_CREATED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_PRIORITY_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'NOTE_CREATED';

export type DashboardSummary = {
  companies: {
    total: number;
  };
  contacts: {
    total: number;
  };
  leads: {
    total: number;
    open: number;
    won: number;
    lost: number;
  };
  tasks: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  activityEvents: {
    total: number;
  };
};

export type CountByLeadStatus = {
  status: LeadStatus;
  count: number;
};

export type CountByTaskStatus = {
  status: TaskStatus;
  count: number;
};

export type CountByPriority = {
  priority: Priority;
  count: number;
};

export type DashboardCompanyPreview = {
  id: string;
  name: string;
};

export type DashboardContactPreview = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export type DashboardLeadPreview = {
  id: string;
  title: string;
  status: LeadStatus;
  priority: Priority;
};

export type DashboardAssignedUserPreview = CurrentUser;

export type DashboardRecentLead = {
  id: string;
  title: string;
  status: LeadStatus;
  priority: Priority;
  importanceLevel: Priority;
  source: Source;
  estimatedBudget: number | null;
  expectedCloseDate: string | null;
  nextStep: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: DashboardCompanyPreview | null;
  contact: DashboardContactPreview | null;
  user: DashboardAssignedUserPreview | null;
};

export type DashboardLeadsOverview = {
  leadsByStatus: CountByLeadStatus[];
  leadsByPriority: CountByPriority[];
  recentLeads: DashboardRecentLead[];
};

export type DashboardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  importanceLevel: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead: DashboardLeadPreview | null;
  contact: DashboardContactPreview | null;
  user: DashboardAssignedUserPreview | null;
};

export type DashboardTasksOverview = {
  tasksByStatus: CountByTaskStatus[];
  tasksByPriority: CountByPriority[];
  pendingTasks: DashboardTask[];
  overdueTasks: DashboardTask[];
  dueSoonTasks: DashboardTask[];
  recentlyCompletedTasks: DashboardTask[];
};

export type DashboardActivityEvent = {
  id: string;
  type: ActivityEventType;
  entityType: EntityType;
  entityId: string;
  title: string;
  description: string | null;
  source: Source;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  taskId: string | null;
  noteId: string | null;
  metadataJson: unknown;
  occurredAt: string;
  createdAt: string;
  actor: CurrentUser | null;
};

export type DashboardRecentActivity = {
  recentActivity: DashboardActivityEvent[];
};

export type DashboardRecentActivityQuery = {
  limit?: number;
  type?: ActivityEventType;
};