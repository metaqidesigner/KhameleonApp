import { Switch, Route } from 'wouter';
import ProjectsList from './ProjectsList';
import ProjectDetail from './detail';

/**
 * pages/projects (this whole feature) uses wouter's real URL routing
 * internally - unlike the rest of the app, which switches pages on
 * Zustand `activeTab` state, not the URL. AppShell mounts exactly this
 * one component for `activeTab === 'projects'`; everything inside it
 * (the list <-> a specific project's detail view) is real client-side
 * routing on /projects and /projects/:id, confined to this feature so it
 * doesn't require retrofitting the rest of the app's navigation model.
 *
 * This file, ProjectsList.tsx (the list + create-project view), and
 * detail.tsx (a single project) were previously unreachable from the
 * running app entirely: 'projects' wasn't a valid TabId, AppShell never
 * imported anything under pages/projects, and no nav surface (sidebar or
 * command palette) linked to it. Found and fixed as part of the
 * 2026-09-03 backend-route audit, alongside real bugs in both the
 * projects list/detail data (routes/projects.ts's completed-task count
 * was wrong three different ways) and detail.tsx's status/priority
 * comparisons (checking for "Completed"/"High" when the real values are
 * lowercase "done"/"high").
 */
export default function Projects() {
  return (
    <Switch>
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects" component={ProjectsList} />
      <Route><ProjectsList /></Route>
    </Switch>
  );
}
