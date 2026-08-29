export type PortfolioAccessRole = 'owner' | 'admin' | 'project_manager' | 'investor' | 'client' | 'viewer';
export type PortfolioHealth = 'on_track' | 'attention' | 'at_risk' | 'needs_plan';

export interface PortfolioProject {
  project_id: string;
  organization_id: string;
  access_role: PortfolioAccessRole;
  can_manage: boolean;
  project_name: string;
  stage: string;
  status: string;
  property_name: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  project_manager_id: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  approved_budget: number;
  committed_amount: number;
  paid_amount: number;
  budget_variance: number;
  next_milestone_id: string | null;
  next_milestone_title: string | null;
  next_milestone_due: string | null;
  overdue_milestones: number;
  latest_update_id: string | null;
  latest_update_title: string | null;
  latest_update_at: string | null;
  commitment_amount: number | null;
  contributed_amount: number | null;
  distributed_amount: number | null;
  health: PortfolioHealth;
  next_action: 'view_update' | 'resolve_overdue' | 'invite_project_manager' | 'update_milestone' | 'publish_update';
  next_action_label: string;
}

export interface ProjectUpdate {
  id: string;
  title: string;
  body: string;
  visibility: string;
  published_at: string | null;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  visibility: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  document_type: string;
  storage_path: string;
  visibility: string;
  created_at: string;
}

export interface ProjectRequest {
  id: string;
  request_type: 'question' | 'change_request' | 'approval' | 'document_request';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'approved' | 'declined' | 'resolved';
  priority: 'normal' | 'high' | 'urgent';
  requested_by: string;
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
