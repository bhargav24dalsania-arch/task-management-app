"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";

const statuses = ["NOT_STARTED", "IN_PROCESS", "ON_HOLD", "SENT_TO_REVIEWER", "COMPLETED"];
const tabs = ["Dashboard", "Tasks", "Masters", "Time", "Planning", "Inbox"];

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function actualHours(task) {
  return (task.timeEntries || []).reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
}

export default function Page() {
  const [tokenReady, setTokenReady] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(null);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState({
    companies: [],
    users: [],
    clients: [],
    scopes: [],
    projects: [],
    tasks: [],
    timeEntries: [],
    dayPlans: [],
    eodReports: [],
    notifications: [],
    statusHistory: [],
    auditLogs: [],
    permissions: [],
    report: null
  });

  const [login, setLogin] = useState({ email: "", password: "" });
  const [taskForm, setTaskForm] = useState({
    id: "",
    clientId: "",
    scopeId: "",
    projectId: "",
    title: "",
    description: "",
    deliverables: "",
    priority: "HIGH",
    dueDate: today(),
    estimateHours: 1,
    assigneeId: "",
    reviewerId: "",
    type: "STANDARD",
    recurrenceRule: "Weekly"
  });
  const [timeForm, setTimeForm] = useState({ id: "", taskId: "", date: today(), hours: 1, note: "", source: "MANUAL" });
  const [planForm, setPlanForm] = useState({ clientId: "", scopeId: "", priority: "HIGH", expectedHours: 1, remarks: "" });
  const [eodForm, setEodForm] = useState({ taskId: "", actualHours: 1, completed: "", inProgress: "", blockers: "", pendingWork: "", reason: "", comments: "" });
  const [companyForm, setCompanyForm] = useState({ id: "", name: "", code: "", startDate: today(), endDate: "", settings: "" });
  const [projectForm, setProjectForm] = useState({ id: "", companyId: "", clientId: "", name: "", status: "Active", startDate: today(), endDate: "" });
  const [clientForm, setClientForm] = useState({ id: "", companyId: "", name: "", type: "B2B", managerId: "", reviewerId: "", preparerId: "", startDate: today(), endDate: "" });
  const [scopeForm, setScopeForm] = useState({ id: "", companyId: "", clientId: "", title: "", description: "", deliverables: "", priority: "HIGH", estimateHours: 1 });
  const [userForm, setUserForm] = useState({ id: "", companyId: "", name: "", email: "", password: "", dateOfJoining: today(), endDate: "", designation: "", education: "", role: "PREPARER", managerId: "" });
  const [commentForm, setCommentForm] = useState({ taskId: "", reason: "", text: "" });
  const [permissionForm, setPermissionForm] = useState({ role: "PREPARER", permissions: "" });

  async function loadAll() {
    setLoading(true);
    try {
      const safeApi = async (path, fallback) => {
        try {
          return await api(path);
        } catch {
          return fallback;
        }
      };
      const [companies, users, clients, scopes, projects, tasks, timeEntries, dayPlans, eodReports, notifications, statusHistory, auditLogs, permissions, report] = await Promise.all([
        safeApi("/companies", []),
        safeApi("/users", []),
        safeApi("/clients", []),
        safeApi("/scopes", []),
        safeApi("/projects", []),
        safeApi("/tasks", []),
        safeApi("/time-entries", []),
        safeApi("/day-plans", []),
        safeApi("/eod-reports", []),
        safeApi("/notifications", []),
        safeApi("/status-history", []),
        safeApi("/audit-logs", []),
        safeApi("/permissions", []),
        safeApi("/reports/summary", null)
      ]);
      setData({ companies, users, clients, scopes, projects, tasks, timeEntries, dayPlans, eodReports, notifications, statusHistory, auditLogs, permissions, report });
      setTaskForm(current => ({
        ...current,
        clientId: current.clientId || clients[0]?.id || "",
        scopeId: current.scopeId || scopes.find(scope => scope.clientId === (current.clientId || clients[0]?.id))?.id || "",
        projectId: clients.find(client => client.id === (current.clientId || clients[0]?.id))?.type === "B2B"
          ? current.projectId || projects.find(project => project.clientId === (current.clientId || clients[0]?.id))?.id || ""
          : "",
        assigneeId: current.assigneeId || users.find(item => item.role === "PREPARER")?.id || users[0]?.id || "",
        reviewerId: current.reviewerId || users.find(item => item.role === "REVIEWER")?.id || users[0]?.id || ""
      }));
      setTimeForm(current => ({ ...current, taskId: current.taskId || tasks[0]?.id || "" }));
      setPlanForm(current => ({
        ...current,
        clientId: current.clientId || clients[0]?.id || "",
        scopeId: current.scopeId || scopes[0]?.id || ""
      }));
      setClientForm(current => ({
        ...current,
        companyId: current.companyId || companies[0]?.id || "",
        managerId: current.managerId || users.find(item => item.role === "SENIOR")?.id || users[0]?.id || "",
        reviewerId: current.reviewerId || users.find(item => item.role === "REVIEWER")?.id || users[0]?.id || "",
        preparerId: current.preparerId || users.find(item => item.role === "PREPARER")?.id || users[0]?.id || ""
      }));
      setProjectForm(current => ({ ...current, companyId: current.companyId || companies[0]?.id || "", clientId: current.clientId || clients.find(client => client.type === "B2B")?.id || "" }));
      setUserForm(current => ({ ...current, companyId: current.companyId || companies[0]?.id || "" }));
      setScopeForm(current => ({ ...current, companyId: current.companyId || companies[0]?.id || "", clientId: current.clientId || clients[0]?.id || "" }));
      setCommentForm(current => ({ ...current, taskId: current.taskId || tasks[0]?.id || "" }));
      setEodForm(current => ({ ...current, taskId: current.taskId || tasks[0]?.id || "" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setTokenReady(true);
        return;
      }
      try {
        const result = await api("/auth/me");
        setUser(result.user);
        await loadAll();
      } catch {
        setToken("");
      } finally {
        setTokenReady(true);
      }
    }
    restore();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (timer?.running) setTick(value => value + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    const permissions = data.permissions
      .filter(item => item.role === permissionForm.role)
      .map(item => item.permission)
      .join(", ");
    setPermissionForm(current => ({ ...current, permissions }));
  }, [data.permissions, permissionForm.role]);

  const selectedTaskClient = useMemo(
    () => data.clients.find(client => client.id === taskForm.clientId),
    [data.clients, taskForm.clientId]
  );
  const taskClientIsB2B = selectedTaskClient?.type === "B2B";
  const taskProjects = useMemo(
    () => data.projects.filter(project => !taskForm.clientId || project.clientId === taskForm.clientId),
    [data.projects, taskForm.clientId]
  );
  const scopedScopes = useMemo(
    () => data.scopes.filter(scope => !taskForm.clientId || scope.clientId === taskForm.clientId),
    [data.scopes, taskForm.clientId]
  );

  const taskMetrics = useMemo(() => {
    const statusCounts = Object.fromEntries(statuses.map(status => [status, 0]));
    let estimated = 0;
    let actual = 0;
    data.tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      estimated += Number(task.estimateHours || 0);
      actual += actualHours(task);
    });
    return { statusCounts, estimated, actual, variance: actual - estimated };
  }, [data.tasks]);

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify(login) });
      setToken(result.token);
      setUser(result.user);
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setData({ companies: [], users: [], clients: [], scopes: [], projects: [], tasks: [], timeEntries: [], dayPlans: [], eodReports: [], notifications: [], statusHistory: [], auditLogs: [], permissions: [], report: null });
  }

  async function createTask(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...taskForm,
        projectId: taskClientIsB2B ? taskForm.projectId || null : null,
        estimateHours: Number(taskForm.estimateHours)
      };
      delete payload.id;
      await api(taskForm.id ? `/tasks/${taskForm.id}` : "/tasks", {
        method: taskForm.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...payload
        })
      });
      setMessage(taskForm.id ? "Task updated." : "Task created and assigned.");
      setTaskForm(current => ({ ...current, id: "", title: "", description: "", deliverables: "" }));
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editTask(task) {
    setTaskForm({
      id: task.id,
      clientId: task.clientId,
      scopeId: task.scopeId,
      projectId: task.projectId || "",
      title: task.title,
      description: task.description,
      deliverables: task.deliverables,
      priority: task.priority,
      dueDate: dateOnly(task.dueDate),
      estimateHours: task.estimateHours,
      assigneeId: task.assigneeId,
      reviewerId: task.reviewerId,
      type: task.type,
      recurrenceRule: task.recurrenceRule || "Weekly"
    });
  }

  async function deleteTask(task) {
    setMessage("");
    try {
      await api(`/tasks/${task.id}`, { method: "DELETE" });
      setMessage("Task deleted from database.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function moveTask(task, status) {
    setMessage("");
    try {
      await api(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: "Workflow update", comment: `Moved to ${label(status)}` })
      });
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addTime(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api(`/tasks/${timeForm.taskId}/time`, {
        method: "POST",
        body: JSON.stringify({ ...timeForm, hours: Number(timeForm.hours) })
      });
      setMessage(`${label(timeForm.source)} time saved.`);
      setTimeForm(current => ({ ...current, note: "" }));
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function timerMs() {
    if (!timer) return 0;
    return Number(timer.elapsedMs || 0) + (timer.running ? Date.now() - timer.startedAt : 0);
  }

  function timerDisplay() {
    void tick;
    const seconds = Math.floor(timerMs() / 1000);
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function startTimer() {
    if (!timeForm.taskId) {
      setMessage("Select a task before starting the timer.");
      return;
    }
    setTimer({ taskId: timeForm.taskId, startedAt: Date.now(), elapsedMs: 0, running: true });
    setMessage("Timer started.");
  }

  function pauseTimer() {
    if (!timer || !timer.running) return;
    setTimer({ ...timer, elapsedMs: timerMs(), running: false });
  }

  function resumeTimer() {
    if (!timer || timer.running) return;
    setTimer({ ...timer, startedAt: Date.now(), running: true });
  }

  async function stopTimer() {
    if (!timer) return;
    const hours = Math.max(0.01, timerMs() / 3600000);
    try {
      await api(`/tasks/${timer.taskId}/time`, {
        method: "POST",
        body: JSON.stringify({ date: today(), hours, note: "Timer recorded work", source: "TIMER" })
      });
      setTimer(null);
      setMessage("Timer time saved.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitPlan(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/day-plans", {
        method: "POST",
        body: JSON.stringify({
          date: today(),
          remarks: planForm.remarks,
          items: [{
            clientId: planForm.clientId,
            scopeId: planForm.scopeId,
            priority: planForm.priority,
            expectedHours: Number(planForm.expectedHours),
            remarks: planForm.remarks
          }]
        })
      });
      setMessage("Day plan submitted to reporting manager.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitEod(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/eod-reports", {
        method: "POST",
        body: JSON.stringify({
          ...eodForm,
          date: today(),
          actualHours: Number(eodForm.actualHours)
        })
      });
      setEodForm(current => ({ ...current, completed: "", inProgress: "", blockers: "", pendingWork: "", reason: "", comments: "" }));
      setMessage("Day-end report and actual time saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveCompany(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = {
        name: companyForm.name,
        code: companyForm.code,
        startDate: companyForm.startDate,
        endDate: companyForm.endDate || null,
        settings: companyForm.settings
      };
      await api(companyForm.id ? `/companies/${companyForm.id}` : "/companies", { method: companyForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setCompanyForm({ id: "", name: "", code: "", startDate: today(), endDate: "", settings: "" });
      setMessage("Company saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveProject(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = { ...projectForm, endDate: projectForm.endDate || null };
      delete payload.id;
      await api(projectForm.id ? `/projects/${projectForm.id}` : "/projects", { method: projectForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setProjectForm(current => ({ id: "", companyId: current.companyId, clientId: current.clientId, name: "", status: "Active", startDate: today(), endDate: "" }));
      setMessage("Project saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveClient(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = { ...clientForm, endDate: clientForm.endDate || null };
      delete payload.id;
      await api(clientForm.id ? `/clients/${clientForm.id}` : "/clients", { method: clientForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setClientForm(current => ({ ...current, id: "", name: "", startDate: today(), endDate: "" }));
      setMessage("Client saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveScope(event) {
    event.preventDefault();
    setMessage("");
    try {
      const selectedClient = data.clients.find(client => client.id === scopeForm.clientId);
      const payload = { ...scopeForm, companyId: scopeForm.companyId || selectedClient?.companyId, estimateHours: Number(scopeForm.estimateHours) };
      delete payload.id;
      await api(scopeForm.id ? `/scopes/${scopeForm.id}` : "/scopes", { method: scopeForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setScopeForm(current => ({ ...current, id: "", title: "", description: "", deliverables: "", estimateHours: 1 }));
      setMessage("Scope of work saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = { ...userForm, endDate: userForm.endDate || null };
      delete payload.id;
      if (userForm.id && !payload.password) delete payload.password;
      await api(userForm.id ? `/users/${userForm.id}` : "/users", { method: userForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setUserForm(current => ({ ...current, id: "", name: "", email: "", password: "", dateOfJoining: today(), endDate: "", designation: "", education: "" }));
      setMessage("User saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteRecord(path, name) {
    setMessage("");
    try {
      await api(path, { method: "DELETE" });
      setMessage(`${name} deleted from database.`);
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveComment(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api(`/tasks/${commentForm.taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ action: "Comment", reason: commentForm.reason, text: commentForm.text })
      });
      setCommentForm(current => ({ ...current, reason: "", text: "" }));
      setMessage("Comment saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function savePermission(event) {
    event.preventDefault();
    setMessage("");
    try {
      const permissions = permissionForm.permissions.split(",").map(item => item.trim()).filter(Boolean);
      await api(`/roles/${permissionForm.role}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) });
      setMessage("Role permissions saved permanently.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveTimeEntry(event) {
    event.preventDefault();
    setMessage("");
    try {
      const payload = { ...timeForm, hours: Number(timeForm.hours) };
      delete payload.id;
      if (timeForm.id) {
        await api(`/time-entries/${timeForm.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Time log updated permanently.");
      } else {
        await api(`/tasks/${timeForm.taskId}/time`, { method: "POST", body: JSON.stringify(payload) });
        setMessage(`${label(timeForm.source)} time saved.`);
      }
      setTimeForm(current => ({ ...current, id: "", note: "" }));
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!tokenReady) return <main className="loading">Loading...</main>;

  if (!user) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <p className="eyebrow">TaskFlow Enterprise</p>
          <h1>Sign in</h1>
          <form onSubmit={handleLogin} className="stack">
            <label>Email<input value={login.email} onChange={event => setLogin({ ...login, email: event.target.value })} /></label>
            <label>Password<input type="password" value={login.password} onChange={event => setLogin({ ...login, password: event.target.value })} /></label>
            <button type="submit">Login</button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <aside>
        <div>
          <h1>TaskFlow</h1>
          <p>{user.companyName || "All Companies"}</p>
        </div>
        <nav>
          {tabs.map(tab => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
        <div className="session">
          <b>{user.name}</b>
          <span>{label(user.role)}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <p className="eyebrow">{activeTab}</p>
            <h2>{activeTab === "Dashboard" ? "Operational dashboard" : activeTab}</h2>
          </div>
          <button onClick={loadAll}>{loading ? "Refreshing" : "Refresh"}</button>
        </header>

        {loading && <p className="notice">Loading saved database records...</p>}
        {message && <p className="notice">{message}</p>}

        {activeTab === "Dashboard" && (
          <>
            <section className="kpis">
              <article><span>Total Tasks</span><b>{data.tasks.length}</b></article>
              <article><span>Open</span><b>{taskMetrics.statusCounts.NOT_STARTED + taskMetrics.statusCounts.IN_PROCESS + taskMetrics.statusCounts.ON_HOLD}</b></article>
              <article><span>Review</span><b>{taskMetrics.statusCounts.SENT_TO_REVIEWER}</b></article>
              <article><span>Completed</span><b>{taskMetrics.statusCounts.COMPLETED}</b></article>
              <article><span>Variance</span><b>{taskMetrics.variance.toFixed(2)}h</b></article>
            </section>
            <section className="panel">
              <h3>Task Status</h3>
              <div className="bars">
                {statuses.map(status => (
                  <div className="bar-row" key={status}>
                    <span>{label(status)}</span>
                    <div><i style={{ width: `${Math.min(100, (taskMetrics.statusCounts[status] || 0) * 20)}%` }} /></div>
                    <b>{taskMetrics.statusCounts[status] || 0}</b>
                  </div>
                ))}
              </div>
            </section>
            <section className="grid">
              <div className="panel list">
                <h3>Status History</h3>
                {data.statusHistory.slice(0, 8).map(item => <p key={item.id}><b>{item.task?.title}</b><span>{label(item.previousStatus || "Created")} to {label(item.newStatus)} | {item.changedBy?.name || "System"}</span></p>)}
              </div>
              <div className="panel list">
                <h3>Audit Log</h3>
                {data.auditLogs.slice(0, 8).map(item => <p key={item.id}><b>{item.action}</b><span>{item.entity} | {item.previousValue || "-"} to {item.newValue || "-"}</span></p>)}
              </div>
            </section>
          </>
        )}

        {activeTab === "Tasks" && (
          <section className="grid">
            <form className="panel stack" onSubmit={createTask}>
              <h3>Create Task</h3>
              <label>Client<select value={taskForm.clientId} onChange={event => {
                const nextClient = data.clients.find(client => client.id === event.target.value);
                setTaskForm({ ...taskForm, clientId: event.target.value, projectId: nextClient?.type === "B2B" ? "" : "", scopeId: "" });
              }}>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name} - {client.type}</option>)}</select></label>
              {taskClientIsB2B && (
                <label>Project<select value={taskForm.projectId} onChange={event => setTaskForm({ ...taskForm, projectId: event.target.value, scopeId: "" })} required><option value="">Select project</option>{taskProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              )}
              <label>Scope<select value={taskForm.scopeId} onChange={event => setTaskForm({ ...taskForm, scopeId: event.target.value })}>{scopedScopes.map(scope => <option key={scope.id} value={scope.id}>{scope.title}</option>)}</select></label>
              <label>Title<input value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} required /></label>
              <label>Description<textarea value={taskForm.description} onChange={event => setTaskForm({ ...taskForm, description: event.target.value })} required /></label>
              <label>Deliverables<textarea value={taskForm.deliverables} onChange={event => setTaskForm({ ...taskForm, deliverables: event.target.value })} required /></label>
              <div className="two">
                <label>Priority<select value={taskForm.priority} onChange={event => setTaskForm({ ...taskForm, priority: event.target.value })}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
                <label>Due Date<input type="date" value={taskForm.dueDate} onChange={event => setTaskForm({ ...taskForm, dueDate: event.target.value })} required /></label>
              </div>
              <div className="two">
                <label>Estimated Hours<input type="number" min="0.25" step="0.25" value={taskForm.estimateHours} onChange={event => setTaskForm({ ...taskForm, estimateHours: event.target.value })} required /></label>
                <label>Type<select value={taskForm.type} onChange={event => setTaskForm({ ...taskForm, type: event.target.value })}><option value="STANDARD">Standard</option><option value="RECURRING">Recurring</option></select></label>
              </div>
              {taskForm.type === "RECURRING" && <label>Recurrence<input value={taskForm.recurrenceRule} onChange={event => setTaskForm({ ...taskForm, recurrenceRule: event.target.value })} /></label>}
              <div className="two">
                <label>Preparer<select value={taskForm.assigneeId} onChange={event => setTaskForm({ ...taskForm, assigneeId: event.target.value })}>{data.users.map(item => <option key={item.id} value={item.id}>{item.name} - {label(item.role)}</option>)}</select></label>
                <label>Reviewer<select value={taskForm.reviewerId} onChange={event => setTaskForm({ ...taskForm, reviewerId: event.target.value })}>{data.users.map(item => <option key={item.id} value={item.id}>{item.name} - {label(item.role)}</option>)}</select></label>
              </div>
              <button type="submit">{taskForm.id ? "Update Task" : "Create Task"}</button>
            </form>

            <section className="board">
              {statuses.map(status => (
                <div className="column" key={status}>
                  <h3>{label(status)} <span>{data.tasks.filter(task => task.status === status).length}</span></h3>
                  {data.tasks.filter(task => task.status === status).map(task => (
                    <article className="task-card" key={task.id}>
                      <div className="tags"><span>{label(task.priority)}</span><span>{task.client?.name}</span></div>
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <small>{task.assignee?.name} to {task.reviewer?.name}</small>
                      <small>Due {dateOnly(task.dueDate)} | Est {Number(task.estimateHours).toFixed(2)}h | Actual {actualHours(task).toFixed(2)}h</small>
                      <div className="actions">
                        <button type="button" onClick={() => editTask(task)}>Edit</button>
                        {status !== "IN_PROCESS" && status !== "COMPLETED" && <button type="button" onClick={() => moveTask(task, "IN_PROCESS")}>Start</button>}
                        {status !== "SENT_TO_REVIEWER" && status !== "COMPLETED" && <button type="button" onClick={() => moveTask(task, "SENT_TO_REVIEWER")}>Send Review</button>}
                        {status === "SENT_TO_REVIEWER" && <button type="button" onClick={() => moveTask(task, "COMPLETED")}>Approve</button>}
                        {status !== "ON_HOLD" && status !== "COMPLETED" && <button type="button" onClick={() => moveTask(task, "ON_HOLD")}>Hold</button>}
                        <button type="button" onClick={() => deleteTask(task)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </section>
            <form className="panel stack" onSubmit={saveComment}>
              <h3>Task Comment</h3>
              <select value={commentForm.taskId} onChange={event => setCommentForm({ ...commentForm, taskId: event.target.value })}>{data.tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
              <input value={commentForm.reason} onChange={event => setCommentForm({ ...commentForm, reason: event.target.value })} placeholder="Reason" required />
              <textarea value={commentForm.text} onChange={event => setCommentForm({ ...commentForm, text: event.target.value })} placeholder="Comment" required />
              <button type="submit">Save Comment</button>
            </form>
          </section>
        )}

        {activeTab === "Masters" && (
          <section className="masters">
            <form className="panel stack" onSubmit={saveCompany}>
              <h3>Company Master</h3>
              <input value={companyForm.name} onChange={event => setCompanyForm({ ...companyForm, name: event.target.value })} placeholder="Company name" required />
              <input value={companyForm.code} onChange={event => setCompanyForm({ ...companyForm, code: event.target.value })} placeholder="Company code" required />
              <div className="two">
                <label>Start Date<input type="date" value={companyForm.startDate || ""} onChange={event => setCompanyForm({ ...companyForm, startDate: event.target.value })} required /></label>
                <label>End Date<input type="date" value={companyForm.endDate || ""} onChange={event => setCompanyForm({ ...companyForm, endDate: event.target.value })} /></label>
              </div>
              <textarea value={companyForm.settings} onChange={event => setCompanyForm({ ...companyForm, settings: event.target.value })} placeholder="Settings" />
              <button type="submit">{companyForm.id ? "Update Company" : "Create Company"}</button>
            </form>

            <form className="panel stack" onSubmit={saveProject}>
              <h3>Project Master</h3>
              <select value={projectForm.companyId} onChange={event => setProjectForm({ ...projectForm, companyId: event.target.value })}><option value="">Company</option>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
              <select value={projectForm.clientId} onChange={event => setProjectForm({ ...projectForm, clientId: event.target.value })} required><option value="">B2B Client</option>{data.clients.filter(client => client.type === "B2B").map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
              <input value={projectForm.name} onChange={event => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="Project name" required />
              <input value={projectForm.status} onChange={event => setProjectForm({ ...projectForm, status: event.target.value })} placeholder="Status" required />
              <div className="two">
                <label>Start Date<input type="date" value={projectForm.startDate || ""} onChange={event => setProjectForm({ ...projectForm, startDate: event.target.value })} required /></label>
                <label>End Date<input type="date" value={projectForm.endDate || ""} onChange={event => setProjectForm({ ...projectForm, endDate: event.target.value })} /></label>
              </div>
              <button type="submit">{projectForm.id ? "Update Project" : "Create Project"}</button>
            </form>

            <form className="panel stack" onSubmit={saveClient}>
              <h3>Client Master</h3>
              <select value={clientForm.companyId} onChange={event => setClientForm({ ...clientForm, companyId: event.target.value })}>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
              <input value={clientForm.name} onChange={event => setClientForm({ ...clientForm, name: event.target.value })} placeholder="Client name" required />
              <select value={clientForm.type} onChange={event => setClientForm({ ...clientForm, type: event.target.value })}><option value="B2B">B2B</option><option value="B2C">B2C</option></select>
              <select value={clientForm.managerId} onChange={event => setClientForm({ ...clientForm, managerId: event.target.value })}>{data.users.map(item => <option key={item.id} value={item.id}>{item.name} - {label(item.role)}</option>)}</select>
              <select value={clientForm.reviewerId} onChange={event => setClientForm({ ...clientForm, reviewerId: event.target.value })}>{data.users.map(item => <option key={item.id} value={item.id}>{item.name} - {label(item.role)}</option>)}</select>
              <select value={clientForm.preparerId} onChange={event => setClientForm({ ...clientForm, preparerId: event.target.value })}>{data.users.map(item => <option key={item.id} value={item.id}>{item.name} - {label(item.role)}</option>)}</select>
              <div className="two">
                <label>Start Date<input type="date" value={clientForm.startDate || ""} onChange={event => setClientForm({ ...clientForm, startDate: event.target.value })} required /></label>
                <label>End Date<input type="date" value={clientForm.endDate || ""} onChange={event => setClientForm({ ...clientForm, endDate: event.target.value })} /></label>
              </div>
              <button type="submit">{clientForm.id ? "Update Client" : "Create Client"}</button>
            </form>

            <form className="panel stack" onSubmit={saveScope}>
              <h3>Scope of Work Master</h3>
              <select value={scopeForm.companyId} onChange={event => setScopeForm({ ...scopeForm, companyId: event.target.value })}>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
              <select value={scopeForm.clientId} onChange={event => setScopeForm({ ...scopeForm, clientId: event.target.value })}>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
              <input value={scopeForm.title} onChange={event => setScopeForm({ ...scopeForm, title: event.target.value })} placeholder="Scope title" required />
              <textarea value={scopeForm.description} onChange={event => setScopeForm({ ...scopeForm, description: event.target.value })} placeholder="Task description" required />
              <textarea value={scopeForm.deliverables} onChange={event => setScopeForm({ ...scopeForm, deliverables: event.target.value })} placeholder="Deliverables" required />
              <div className="two">
                <select value={scopeForm.priority} onChange={event => setScopeForm({ ...scopeForm, priority: event.target.value })}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
                <input type="number" min="0.25" step="0.25" value={scopeForm.estimateHours} onChange={event => setScopeForm({ ...scopeForm, estimateHours: event.target.value })} required />
              </div>
              <button type="submit">{scopeForm.id ? "Update Scope" : "Create Scope"}</button>
            </form>

            <form className="panel stack" onSubmit={saveUser}>
              <h3>User Master</h3>
              <select value={userForm.companyId} onChange={event => setUserForm({ ...userForm, companyId: event.target.value })}>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
              <input value={userForm.name} onChange={event => setUserForm({ ...userForm, name: event.target.value })} placeholder="Name" required />
              <input value={userForm.email} onChange={event => setUserForm({ ...userForm, email: event.target.value })} placeholder="Email" required />
              <input type="password" value={userForm.password} onChange={event => setUserForm({ ...userForm, password: event.target.value })} placeholder={userForm.id ? "New password optional" : "Password"} required={!userForm.id} />
              <div className="two">
                <label>Date of Joining<input type="date" value={userForm.dateOfJoining || ""} onChange={event => setUserForm({ ...userForm, dateOfJoining: event.target.value })} /></label>
                <label>User End Date<input type="date" value={userForm.endDate || ""} onChange={event => setUserForm({ ...userForm, endDate: event.target.value })} /></label>
              </div>
              <div className="two">
                <select value={userForm.role} onChange={event => setUserForm({ ...userForm, role: event.target.value })}><option value="MASTER_ADMIN">Master Admin</option><option value="ADMIN">Admin</option><option value="SENIOR">Senior</option><option value="REVIEWER">Reviewer</option><option value="PREPARER">Preparer</option></select>
              </div>
              <input value={userForm.designation} onChange={event => setUserForm({ ...userForm, designation: event.target.value })} placeholder="Designation" />
              <input value={userForm.education} onChange={event => setUserForm({ ...userForm, education: event.target.value })} placeholder="Education" />
              <select value={userForm.managerId} onChange={event => setUserForm({ ...userForm, managerId: event.target.value })}><option value="">No manager</option>{data.users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <button type="submit">{userForm.id ? "Update User" : "Create User"}</button>
            </form>

            <form className="panel stack" onSubmit={savePermission}>
              <h3>Roles and Permissions</h3>
              <select value={permissionForm.role} onChange={event => setPermissionForm({ ...permissionForm, role: event.target.value })}><option value="MASTER_ADMIN">Master Admin</option><option value="ADMIN">Admin</option><option value="SENIOR">Senior</option><option value="REVIEWER">Reviewer</option><option value="PREPARER">Preparer</option></select>
              <textarea value={permissionForm.permissions} onChange={event => setPermissionForm({ ...permissionForm, permissions: event.target.value })} placeholder="Comma separated permissions" />
              <button type="submit">Save Permissions</button>
            </form>

            <div className="panel list"><h3>Companies</h3>{data.companies.map(company => <p key={company.id}><b>{company.name}</b><span>{company.code} | Start {dateOnly(company.startDate)} | End {dateOnly(company.endDate) || "Active"}</span><span className="row-actions"><button onClick={() => setCompanyForm({ id: company.id, name: company.name, code: company.code, startDate: dateOnly(company.startDate), endDate: dateOnly(company.endDate), settings: company.settings || "" })}>Edit</button><button onClick={() => deleteRecord(`/companies/${company.id}`, "Company")}>Delete</button></span></p>)}</div>
            <div className="panel list"><h3>Projects</h3>{data.projects.map(project => <p key={project.id}><b>{project.name}</b><span>{project.status} | Start {dateOnly(project.startDate)} | End {dateOnly(project.endDate) || "Active"}</span><span className="row-actions"><button onClick={() => setProjectForm({ id: project.id, companyId: project.companyId, clientId: project.clientId || "", name: project.name, status: project.status, startDate: dateOnly(project.startDate), endDate: dateOnly(project.endDate) })}>Edit</button><button onClick={() => deleteRecord(`/projects/${project.id}`, "Project")}>Delete</button></span></p>)}</div>
            <div className="panel list"><h3>Clients</h3>{data.clients.map(client => <p key={client.id}><b>{client.name}</b><span>{client.type} | Manager {client.manager?.name} | Reviewer {client.reviewer?.name} | Preparer {client.preparer?.name}</span><span className="row-actions"><button onClick={() => setClientForm({ id: client.id, companyId: client.companyId, name: client.name, type: client.type, managerId: client.managerId, reviewerId: client.reviewerId, preparerId: client.preparerId, startDate: dateOnly(client.startDate), endDate: dateOnly(client.endDate) })}>Edit</button><button onClick={() => deleteRecord(`/clients/${client.id}`, "Client")}>Delete</button></span></p>)}</div>
            <div className="panel list"><h3>Scopes</h3>{data.scopes.map(scope => <p key={scope.id}><b>{scope.title}</b><span>{scope.client?.name} | {label(scope.priority)} | Est {scope.estimateHours}h</span><span className="row-actions"><button onClick={() => setScopeForm({ id: scope.id, companyId: scope.companyId, clientId: scope.clientId, title: scope.title, description: scope.description, deliverables: scope.deliverables, priority: scope.priority, estimateHours: scope.estimateHours })}>Edit</button><button onClick={() => deleteRecord(`/scopes/${scope.id}`, "Scope")}>Delete</button></span></p>)}</div>
            <div className="panel list"><h3>Users</h3>{data.users.map(item => <p key={item.id}><b>{item.name}</b><span>{item.email} | {label(item.role)} | {item.designation}</span><span className="row-actions"><button onClick={() => setUserForm({ id: item.id, companyId: item.companyId, name: item.name, email: item.email, password: "", dateOfJoining: dateOnly(item.dateOfJoining), endDate: dateOnly(item.endDate), designation: item.designation || "", education: item.education || "", role: item.role, managerId: item.managerId || "" })}>Edit</button><button onClick={() => deleteRecord(`/users/${item.id}`, "User")}>Delete</button></span></p>)}</div>
            <div className="panel list"><h3>Saved Permissions</h3>{data.permissions.map(item => <p key={item.id}><b>{label(item.role)}</b><span>{item.permission}</span></p>)}</div>
          </section>
        )}

        {activeTab === "Time" && (
          <section className="grid">
            <div className="panel stack">
              <h3>Timer</h3>
              <label>Task<select value={timeForm.taskId} onChange={event => setTimeForm({ ...timeForm, taskId: event.target.value })}>{data.tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
              <div className="timer-face">{timerDisplay()}</div>
              <div className="actions">
                <button type="button" onClick={startTimer}>Start</button>
                <button type="button" onClick={pauseTimer}>Pause</button>
                <button type="button" onClick={resumeTimer}>Resume</button>
                <button type="button" onClick={stopTimer}>Stop</button>
              </div>
              <form className="stack" onSubmit={saveTimeEntry}>
                <h3>Manual Time Entry</h3>
                <label>Task<select value={timeForm.taskId} onChange={event => setTimeForm({ ...timeForm, taskId: event.target.value })}>{data.tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
                <div className="two">
                  <label>Date<input type="date" value={timeForm.date} onChange={event => setTimeForm({ ...timeForm, date: event.target.value })} /></label>
                  <label>Hours<input type="number" min="0.01" step="0.25" value={timeForm.hours} onChange={event => setTimeForm({ ...timeForm, hours: event.target.value })} /></label>
                </div>
                <label>Source<select value={timeForm.source} onChange={event => setTimeForm({ ...timeForm, source: event.target.value })}><option value="MANUAL">Manual</option><option value="EOD">EOD</option></select></label>
                <label>Work Note<textarea value={timeForm.note} onChange={event => setTimeForm({ ...timeForm, note: event.target.value })} required /></label>
                <button type="submit">{timeForm.id ? "Update Time" : "Save Time"}</button>
              </form>
            </div>
            <div className="panel list">
              <h3>Time Sheet</h3>
              {data.timeEntries.map(entry => <p key={entry.id}><b>{dateOnly(entry.date)} | {label(entry.source)}</b><span>{entry.user?.name} | {entry.task?.title} | {Number(entry.hours).toFixed(2)}h</span><span className="row-actions"><button type="button" onClick={() => setTimeForm({ id: entry.id, taskId: entry.taskId, date: dateOnly(entry.date), hours: entry.hours, note: entry.note, source: entry.source })}>Edit</button><button type="button" onClick={() => deleteRecord(`/time-entries/${entry.id}`, "Time log")}>Delete</button></span></p>)}
            </div>
          </section>
        )}

        {activeTab === "Planning" && (
          <section className="grid">
            <form className="panel stack" onSubmit={submitPlan}>
              <h3>Morning Day Plan</h3>
              <label>Client<select value={planForm.clientId} onChange={event => setPlanForm({ ...planForm, clientId: event.target.value, scopeId: "" })}>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label>Scope<select value={planForm.scopeId} onChange={event => setPlanForm({ ...planForm, scopeId: event.target.value })}>{data.scopes.filter(scope => !planForm.clientId || scope.clientId === planForm.clientId).map(scope => <option key={scope.id} value={scope.id}>{scope.title}</option>)}</select></label>
              <div className="two">
                <label>Priority<select value={planForm.priority} onChange={event => setPlanForm({ ...planForm, priority: event.target.value })}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
                <label>Expected Hours<input type="number" min="0.25" step="0.25" value={planForm.expectedHours} onChange={event => setPlanForm({ ...planForm, expectedHours: event.target.value })} /></label>
              </div>
              <label>Remarks<textarea value={planForm.remarks} onChange={event => setPlanForm({ ...planForm, remarks: event.target.value })} /></label>
              <button type="submit">Submit Day Plan</button>
            </form>
            <form className="panel stack" onSubmit={submitEod}>
              <h3>Day-End Report</h3>
              <select value={eodForm.taskId} onChange={event => setEodForm({ ...eodForm, taskId: event.target.value })}>{data.tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
              <input type="number" min="0.25" step="0.25" value={eodForm.actualHours} onChange={event => setEodForm({ ...eodForm, actualHours: event.target.value })} placeholder="Actual hours" />
              <textarea value={eodForm.completed} onChange={event => setEodForm({ ...eodForm, completed: event.target.value })} placeholder="Tasks completed" required />
              <textarea value={eodForm.inProgress} onChange={event => setEodForm({ ...eodForm, inProgress: event.target.value })} placeholder="Tasks in progress" />
              <textarea value={eodForm.blockers} onChange={event => setEodForm({ ...eodForm, blockers: event.target.value })} placeholder="Issues or blockers" />
              <textarea value={eodForm.pendingWork} onChange={event => setEodForm({ ...eodForm, pendingWork: event.target.value })} placeholder="Pending work" />
              <input value={eodForm.reason} onChange={event => setEodForm({ ...eodForm, reason: event.target.value })} placeholder="Reason for incomplete task" />
              <textarea value={eodForm.comments} onChange={event => setEodForm({ ...eodForm, comments: event.target.value })} placeholder="Comments" required />
              <button type="submit">Submit EOD</button>
            </form>
            <div className="panel list"><h3>Saved Day Plans</h3>{data.dayPlans.map(plan => <p key={plan.id}><b>{dateOnly(plan.date)} | {plan.user?.name}</b><span>{plan.items?.length || 0} planned items | {plan.remarks}</span></p>)}</div>
            <div className="panel list"><h3>Saved EOD Reports</h3>{data.eodReports.map(report => <p key={report.id}><b>{dateOnly(report.date)} | {report.user?.name}</b><span>{Number(report.actualHours).toFixed(2)}h | {report.completed}</span></p>)}</div>
          </section>
        )}

        {activeTab === "Inbox" && (
          <section className="panel list">
            <h3>Inbox</h3>
            {data.notifications.map(note => (
              <p key={note.id}>
                <b>{note.title}</b>
                <span>{note.category} | {note.priority} | {note.message}</span>
              </p>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
