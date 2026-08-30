import type { PortalPersona } from '@/components/app/AuthProvider';

export type PortalIntent = Exclude<PortalPersona, 'admin'>;

const portalPaths: Record<PortalIntent, string> = {
  project_manager: '/pm',
  investor: '/investor',
  client: '/client',
};

export const canEnterPortal = (intent: PortalIntent, personas: PortalPersona[]) =>
  intent === 'project_manager'
    ? personas.includes('admin') || personas.includes('project_manager')
    : personas.includes(intent);

export const getPreferredPortalPath = (personas: PortalPersona[]) => {
  if (personas.includes('admin') || personas.includes('project_manager')) return portalPaths.project_manager;
  if (personas.includes('investor')) return portalPaths.investor;
  if (personas.includes('client')) return portalPaths.client;
  return '/get-started';
};

