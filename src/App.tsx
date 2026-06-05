import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Signature,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Swal from "sweetalert2";

import {
  type AuthSession,
  completeNewPassword,
  confirmRegistration,
  createStaffOpportunity,
  disableResourceUser,
  downloadStaffApplicationCv,
  finishPasswordReset,
  getStoredSession,
  inviteResourceUser,
  listStaffApplications,
  listResourceUsers,
  listStaffOpportunities,
  registerWithCredentials,
  resendRegistrationCode,
  signInWithCredentials,
  signOut,
  startPasswordReset,
  type ResourceUser,
  type StaffApplication,
  type StaffApplicationCv,
  type StaffOpportunity,
  type StaffOpportunityPayload,
  type StaffOpportunityStatus,
  updateStaffOpportunity,
} from "./auth";
import {
  buildSignatureHtml,
  defaultSignatureValues,
  signatureLogoWidth,
  type SignatureValues,
} from "./signature";

type SignedOutMode =
  | "confirm-registration"
  | "login"
  | "new-password"
  | "register"
  | "reset-password";

type AuthViewState =
  | {
      error?: string;
      mode?: SignedOutMode;
      notice?: string;
      status: "signed-out";
      username?: string;
    }
  | { session: AuthSession; status: "signed-in" }
  | { status: "checking" };

type ModuleKey =
  | "applications"
  | "dashboard"
  | "opportunities"
  | "signatures"
  | "users"
  | "requests"
  | "knowledge";

type LoadStatus = "error" | "idle" | "loading" | "saving";
type CopyStatus = "copied" | "error" | "idle";

interface ModuleDefinition {
  adminOnly?: boolean;
  description: string;
  icon: ReactNode;
  key: ModuleKey;
  label: string;
  section: "workspace" | "operations" | "company";
}

const logoUrl = "/brand/logo/cognitivebridge-logo-horizontal-primary.png";
const isotypeUrl = "/brand/logo/cognitivebridge-isotype-primary.png";

const modules: ModuleDefinition[] = [
  {
    description: "Indicadores y estado general del portal interno.",
    icon: <LayoutDashboard size={19} />,
    key: "dashboard",
    label: "Dashboard",
    section: "workspace",
  },
  {
    adminOnly: true,
    description: "Oportunidades y publicaciones para servicios de staff.",
    icon: <BriefcaseBusiness size={19} />,
    key: "opportunities",
    label: "Staff Services",
    section: "operations",
  },
  {
    adminOnly: true,
    description: "Base de postulantes asociados a oportunidades publicadas.",
    icon: <ClipboardList size={19} />,
    key: "applications",
    label: "Postulantes",
    section: "operations",
  },
  {
    description: "Generador de firmas HTML para el equipo.",
    icon: <Signature size={19} />,
    key: "signatures",
    label: "Firmas",
    section: "operations",
  },
  {
    adminOnly: true,
    description: "Altas, roles y accesos de usuarios internos.",
    icon: <Users size={19} />,
    key: "users",
    label: "Usuarios",
    section: "operations",
  },
  {
    adminOnly: true,
    description: "Solicitudes comerciales recibidas desde la web.",
    icon: <ClipboardList size={19} />,
    key: "requests",
    label: "Solicitudes",
    section: "company",
  },
  {
    description: "Documentacion operativa y decisiones internas.",
    icon: <FileText size={19} />,
    key: "knowledge",
    label: "Conocimiento",
    section: "company",
  },
];

const sectionLabels = {
  company: "Compañia",
  operations: "Operación",
  workspace: "Workspace",
} satisfies Record<ModuleDefinition["section"], string>;

const sectionOrder: ModuleDefinition["section"][] = [
  "workspace",
  "operations",
  "company",
];

const statusLabels: Record<StaffOpportunityStatus, string> = {
  active: "Activa",
  closed: "Cerrada",
  draft: "Borrador",
  paused: "Pausada",
};

const serviceModels = [
  "Staff Augmentation",
  "Outsourcing",
  "Hunting / Reclutamiento",
  "Equipos Dedicados",
  "Servicios Gestionados",
];

const areas = [
  "AI",
  "Data",
  "Cloud",
  "Software",
  "QA",
  "Product",
  "Cybersecurity",
  "Operaciones",
];

const modalities = ["Remoto", "Híbrido", "Presencial", "Por definir"];
const seniorities = ["Junior", "Semi senior", "Senior", "Lead", "Mixto"];

const initialOpportunityForm = {
  area: "Software",
  location: "Chile",
  modality: "Remoto",
  requirements: "",
  seniority: "Senior",
  serviceModel: "Staff Augmentation",
  status: "draft" as StaffOpportunityStatus,
  summary: "",
  title: "",
};

const opportunitySummaryMaxLength = 1800;
const opportunityRequirementsMaxItems = 80;
const opportunityRequirementsMaxLength = 2400;

let lastAlertKey = "";
let lastAlertAt = 0;

function notify(message: string, type: "error" | "success" = "error") {
  const key = `${type}:${message}`;
  const now = Date.now();

  if (lastAlertKey === key && now - lastAlertAt < 600) {
    return;
  }

  lastAlertKey = key;
  lastAlertAt = now;

  void Swal.fire({
    buttonsStyling: false,
    confirmButtonText: "Entendido",
    customClass: {
      confirmButton: "swal-action",
      htmlContainer: "swal-copy",
      popup: "swal-card",
      title: "swal-title",
    },
    html: `<div class="swal-brand"><img src="${isotypeUrl}" alt="" /><span>CognitiveBridge EMAUS</span></div><p>${escapeHtml(message)}</p>`,
    icon: type,
    title: type === "success" ? "Listo" : "Revisemos esto",
  });
}

function notifyToast(message: string, type: "error" | "success" = "success") {
  const key = `toast:${type}:${message}`;
  const now = Date.now();

  if (lastAlertKey === key && now - lastAlertAt < 600) {
    return;
  }

  lastAlertKey = key;
  lastAlertAt = now;

  void Swal.fire({
    customClass: {
      htmlContainer: "swal-toast-copy",
      popup: `swal-toast ${type}`,
      timerProgressBar: "swal-toast-progress",
      title: "swal-toast-title",
    },
    html: `<span class="swal-toast-brand">EMAUS</span><span>${escapeHtml(message)}</span>`,
    icon: type,
    position: "top-end",
    showConfirmButton: false,
    timer: 3600,
    timerProgressBar: true,
    toast: true,
    width: "430px",
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&"'<>]/g,
    (character) =>
      ({
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
        "<": "&lt;",
        ">": "&gt;",
      })[character] ?? character,
  );
}

function initials(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toPayload(
  form: typeof initialOpportunityForm,
): StaffOpportunityPayload {
  return {
    area: form.area,
    location: form.location.trim(),
    modality: form.modality,
    requirements: parseOpportunityRequirements(form.requirements),
    seniority: form.seniority,
    serviceModel: form.serviceModel,
    status: form.status,
    summary: form.summary.trim(),
    title: form.title.trim(),
  };
}

function toOpportunityForm(opportunity: StaffOpportunity) {
  return {
    area: opportunity.area,
    location: opportunity.location,
    modality: opportunity.modality,
    requirements: opportunity.requirements.join("\n"),
    seniority: opportunity.seniority,
    serviceModel: opportunity.serviceModel,
    status: opportunity.status,
    summary: opportunity.summary,
    title: opportunity.title,
  };
}

function parseOpportunityRequirements(value: string) {
  return value
    .split("\n")
    .map((requirement) => requirement.trim())
    .filter(Boolean);
}

function saveBase64File(file: StaffApplicationCv) {
  const binary = window.atob(file.cvBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: file.contentType || "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}

function App() {
  const [view, setView] = useState<AuthViewState>({ status: "checking" });

  useEffect(() => {
    let mounted = true;
    const previewSession =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("preview") ===
        "backoffice";

    if (previewSession) {
      setView({
        session: {
          accessToken: "local-preview",
          authorizationToken: "local-preview",
          email: "n.miranda@cognitivebridge.cl",
          groups: ["internal-users", "internal-admins"],
          idToken: "local-preview",
          username: "local-preview",
        },
        status: "signed-in",
      });

      return () => {
        mounted = false;
      };
    }

    getStoredSession().then((session) => {
      if (!mounted) {
        return;
      }

      setView(
        session
          ? { session, status: "signed-in" }
          : { mode: "login", status: "signed-out" },
      );
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    setView({ mode: "login", status: "signed-out" });
  }

  if (view.status === "checking") {
    return <LoadingScreen />;
  }

  if (view.status === "signed-out") {
    return (
      <AuthFlow
        onSignedIn={(session) => setView({ session, status: "signed-in" })}
        setView={setView}
        view={view}
      />
    );
  }

  return <Backoffice onSignOut={handleSignOut} session={view.session} />;
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <img alt="CognitiveBridge" src={logoUrl} />
      <span>Preparando portal interno...</span>
    </main>
  );
}

function AuthFlow({
  onSignedIn,
  setView,
  view,
}: {
  onSignedIn: (session: AuthSession) => void;
  setView: (view: AuthViewState) => void;
  view: Extract<AuthViewState, { status: "signed-out" }>;
}) {
  const mode = view.mode ?? "login";

  if (mode === "register") {
    return (
      <RegisterScreen
        onBack={() => setView({ mode: "login", status: "signed-out" })}
        onConfirm={(username) =>
          setView({
            mode: "confirm-registration",
            notice: "Te enviamos un código al correo corporativo.",
            status: "signed-out",
            username,
          })
        }
      />
    );
  }

  if (mode === "confirm-registration") {
    return (
      <ConfirmRegistrationScreen
        initialEmail={view.username ?? ""}
        onBack={() => setView({ mode: "login", status: "signed-out" })}
        onConfirmed={() =>
          setView({
            mode: "login",
            notice: "Cuenta confirmada. Ya puedes iniciar sesión.",
            status: "signed-out",
          })
        }
      />
    );
  }

  if (mode === "new-password") {
    return (
      <NewPasswordScreen
        onBack={() => setView({ mode: "login", status: "signed-out" })}
        onSignedIn={onSignedIn}
      />
    );
  }

  if (mode === "reset-password") {
    return (
      <ResetPasswordScreen
        initialEmail={view.username ?? ""}
        onBack={() => setView({ mode: "login", status: "signed-out" })}
      />
    );
  }

  return (
    <LoginScreen
      notice={view.notice}
      onForgotPassword={(email) =>
        setView({
          mode: "reset-password",
          status: "signed-out",
          username: email,
        })
      }
      onRegister={() => setView({ mode: "register", status: "signed-out" })}
      onSignedIn={onSignedIn}
      onTemporaryPassword={() =>
        setView({ mode: "new-password", status: "signed-out" })
      }
    />
  );
}

function AuthLayout({
  children,
  kicker,
  title,
}: {
  children: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-visual">
          <img alt="CognitiveBridge" src={logoUrl} />
          <div>
            <p>{kicker}</p>
            <h1>{title}</h1>
            <span>Acceso corporativo @cognitivebridge.cl</span>
          </div>
        </div>
        <div className="auth-panel">{children}</div>
      </section>
    </main>
  );
}

function LoginScreen({
  notice,
  onForgotPassword,
  onRegister,
  onSignedIn,
  onTemporaryPassword,
}: {
  notice?: string;
  onForgotPassword: (email: string) => void;
  onRegister: () => void;
  onSignedIn: (session: AuthSession) => void;
  onTemporaryPassword: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (notice) {
      notify(notice, "success");
    }
  }, [notice]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);

    try {
      const result = await signInWithCredentials(email, password);

      if (result.status === "signed-in") {
        onSignedIn(result.session);
      } else if (result.status === "new-password") {
        onTemporaryPassword();
      } else {
        onForgotPassword(email);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo ingresar.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AuthLayout kicker="Portal interno" title="EMAUS">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Correo corporativo</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <div className="auth-actions">
          <button className="primary-button" disabled={isWorking} type="submit">
            {isWorking ? "Validando..." : "Iniciar sesión"}
          </button>
          <button
            className="secondary-button"
            onClick={onRegister}
            type="button"
          >
            Crear cuenta
          </button>
        </div>
        <button
          className="link-button"
          onClick={() => onForgotPassword(email)}
          type="button"
        >
          Olvidé mi contraseña
        </button>
      </form>
    </AuthLayout>
  );
}

function RegisterScreen({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: (username: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);

    try {
      const result = await registerWithCredentials(fullName, email, password);
      onConfirm(result.username);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo registrar.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AuthLayout kicker="Registro corporativo" title="Crear cuenta">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nombre completo</span>
          <input
            autoComplete="name"
            onChange={(event) => setFullName(event.target.value)}
            value={fullName}
          />
        </label>
        <label className="field">
          <span>Correo corporativo</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <div className="auth-actions">
          <button className="primary-button" disabled={isWorking} type="submit">
            {isWorking ? "Creando..." : "Crear cuenta"}
          </button>
          <button className="secondary-button" onClick={onBack} type="button">
            Volver
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

function ConfirmRegistrationScreen({
  initialEmail,
  onBack,
  onConfirmed,
}: {
  initialEmail: string;
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);

    try {
      await confirmRegistration(email, code);
      onConfirmed();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo confirmar.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleResend() {
    try {
      await resendRegistrationCode(email);
      notify("Código reenviado al correo corporativo.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo reenviar.");
    }
  }

  return (
    <AuthLayout kicker="Validación" title="Confirmar cuenta">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Correo corporativo</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          <span>Código recibido</span>
          <input
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
            value={code}
          />
        </label>
        <div className="auth-actions">
          <button className="primary-button" disabled={isWorking} type="submit">
            Confirmar
          </button>
          <button
            className="secondary-button"
            onClick={handleResend}
            type="button"
          >
            Reenviar código
          </button>
        </div>
        <button className="link-button" onClick={onBack} type="button">
          Volver al login
        </button>
      </form>
    </AuthLayout>
  );
}

function NewPasswordScreen({
  onBack,
  onSignedIn,
}: {
  onBack: () => void;
  onSignedIn: (session: AuthSession) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);

    try {
      const session = await completeNewPassword(newPassword);
      onSignedIn(session);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AuthLayout kicker="Seguridad" title="Nueva contraseña">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nueva contraseña</span>
          <input
            autoComplete="new-password"
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            value={newPassword}
          />
        </label>
        <div className="auth-actions">
          <button className="primary-button" disabled={isWorking} type="submit">
            Cambiar contraseña
          </button>
          <button className="secondary-button" onClick={onBack} type="button">
            Volver
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

function ResetPasswordScreen({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function handleRequestCode() {
    try {
      await startPasswordReset(email);
      notify("Código enviado al correo corporativo.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo enviar código.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);

    try {
      await finishPasswordReset(email, code, newPassword);
      notify("Contraseña actualizada.", "success");
      onBack();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AuthLayout kicker="Recuperación" title="Restablecer acceso">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Correo corporativo</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <button
          className="secondary-button fit"
          onClick={handleRequestCode}
          type="button"
        >
          Enviar código
        </button>
        <label className="field">
          <span>Código recibido</span>
          <input
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
            value={code}
          />
        </label>
        <label className="field">
          <span>Nueva contraseña</span>
          <input
            autoComplete="new-password"
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            value={newPassword}
          />
        </label>
        <div className="auth-actions">
          <button className="primary-button" disabled={isWorking} type="submit">
            Cambiar contraseña
          </button>
          <button className="secondary-button" onClick={onBack} type="button">
            Volver
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

function Backoffice({
  onSignOut,
  session,
}: {
  onSignOut: () => void;
  session: AuthSession;
}) {
  const isAdmin = session.groups.includes("internal-admins");
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const currentModule =
    modules.find((module) => module.key === activeModule) ?? modules[0];
  const isRestricted = Boolean(currentModule.adminOnly && !isAdmin);

  function selectModule(moduleKey: ModuleKey) {
    setActiveModule(moduleKey);
    setIsMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <Topbar
        currentModule={currentModule}
        onMenuToggle={() => setIsMobileNavOpen((current) => !current)}
        onSignOut={onSignOut}
        session={session}
      />
      <div className="app-body">
        <Sidebar
          activeModule={activeModule}
          isAdmin={isAdmin}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          onSelect={selectModule}
          session={session}
        />
        <main className="content-area">
          {isRestricted ? (
            <RestrictedModule module={currentModule} />
          ) : (
            <ModuleContent activeModule={activeModule} session={session} />
          )}
        </main>
      </div>
    </div>
  );
}

function Topbar({
  currentModule,
  onMenuToggle,
  onSignOut,
  session,
}: {
  currentModule: ModuleDefinition;
  onMenuToggle: () => void;
  onSignOut: () => void;
  session: AuthSession;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-only"
          onClick={onMenuToggle}
          type="button"
        >
          <Menu size={22} />
        </button>
        <img alt="CognitiveBridge" src={logoUrl} />
      </div>
      <strong className="topbar-title">{currentModule.label}</strong>
      <div className="topbar-actions">
        <button className="profile-button" title={session.email} type="button">
          {initials(session.email)}
        </button>
        <button className="topbar-signout" onClick={onSignOut} type="button">
          <LogOut size={18} />
          Salir
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  activeModule,
  isAdmin,
  isOpen,
  onClose,
  onSelect,
  session,
}: {
  activeModule: ModuleKey;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (module: ModuleKey) => void;
  session: AuthSession;
}) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-profile">
          <div className="avatar">{initials(session.email)}</div>
          <div>
            <strong>{session.email.split("@")[0]}</strong>
            <span>{isAdmin ? "Administrador" : "Usuario interno"}</span>
          </div>
          <button
            className="icon-button mobile-only"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {sectionOrder.map((section) => (
          <nav
            className="nav-group"
            key={section}
            aria-label={sectionLabels[section]}
          >
            <span>{sectionLabels[section]}</span>
            {modules
              .filter((module) => module.section === section)
              .map((module) => {
                const isActive = module.key === activeModule;
                const restricted = module.adminOnly && !isAdmin;

                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={`nav-item${isActive ? " active" : ""}`}
                    key={module.key}
                    onClick={() => onSelect(module.key)}
                    type="button"
                  >
                    {module.icon}
                    <span>{module.label}</span>
                    {restricted ? <Lock size={14} /> : null}
                  </button>
                );
              })}
          </nav>
        ))}
      </aside>
      {isOpen ? (
        <button className="sidebar-scrim" onClick={onClose} type="button" />
      ) : null}
    </>
  );
}

function ModuleContent({
  activeModule,
  session,
}: {
  activeModule: ModuleKey;
  session: AuthSession;
}) {
  if (activeModule === "opportunities") {
    return <OpportunitiesModule />;
  }

  if (activeModule === "applications") {
    return <ApplicationsModule />;
  }

  if (activeModule === "signatures") {
    return <SignatureModule />;
  }

  if (activeModule === "users") {
    return <UsersModule />;
  }

  if (activeModule === "requests") {
    return <PlaceholderModule kind="requests" />;
  }

  if (activeModule === "knowledge") {
    return <PlaceholderModule kind="knowledge" />;
  }

  return <DashboardModule session={session} />;
}

function DashboardModule({ session }: { session: AuthSession }) {
  const isAdmin = session.groups.includes("internal-admins");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [opportunities, setOpportunities] = useState<StaffOpportunity[]>([]);
  const [users, setUsers] = useState<ResourceUser[]>([]);

  useEffect(() => {
    if (session.authorizationToken === "local-preview") {
      setOpportunities([
        {
          area: "Data",
          createdAt: new Date().toISOString(),
          createdBy: session.email,
          location: "Chile",
          modality: "Remoto",
          opportunityId: "preview-1",
          requirements: ["Python", "AWS", "Modelado de datos"],
          seniority: "Senior",
          serviceModel: "Staff Augmentation",
          status: "active",
          summary: "Rol de datos para levantar capacidades analíticas.",
          title: "Senior Data Engineer",
          updatedAt: new Date().toISOString(),
          updatedBy: session.email,
        },
        {
          area: "Software",
          createdAt: new Date().toISOString(),
          createdBy: session.email,
          location: "Chile",
          modality: "Híbrido",
          opportunityId: "preview-2",
          requirements: ["React", "Node.js", "Arquitectura frontend"],
          seniority: "Lead",
          serviceModel: "Equipos Dedicados",
          status: "draft",
          summary: "Liderazgo técnico para célula de producto digital.",
          title: "Frontend Lead",
          updatedAt: new Date().toISOString(),
          updatedBy: session.email,
        },
      ]);
      setUsers([
        {
          createdAt: new Date().toISOString(),
          email: session.email,
          enabled: true,
          status: "CONFIRMED",
          updatedAt: new Date().toISOString(),
          username: "local-preview",
        },
      ]);
      return;
    }

    if (!isAdmin) {
      return;
    }

    setStatus("loading");
    Promise.all([listStaffOpportunities(), listResourceUsers()])
      .then(([opportunitiesResponse, usersResponse]) => {
        setOpportunities(opportunitiesResponse.opportunities);
        setUsers(usersResponse.users);
        setStatus("idle");
      })
      .catch((error) => {
        setStatus("error");
        notifyToast(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el dashboard.",
          "error",
        );
      });
  }, [isAdmin]);

  const activeCount = opportunities.filter(
    (opportunity) => opportunity.status === "active",
  ).length;
  const draftCount = opportunities.filter(
    (opportunity) => opportunity.status === "draft",
  ).length;

  return (
    <section className="module-stack">
      <ModuleHeader
        description="Vista central para operar herramientas internas, accesos y oportunidades."
        kicker="Workspace interno"
        title="Panel operativo"
      />
      <div className="metric-grid">
        <MetricCard
          icon={<BriefcaseBusiness />}
          label="Oportunidades activas"
          value={activeCount}
        />
        <MetricCard icon={<FileText />} label="Borradores" value={draftCount} />
        <MetricCard
          icon={<Users />}
          label="Usuarios internos"
          value={users.length}
        />
        <MetricCard
          icon={<ShieldCheck />}
          label="Rol actual"
          value={isAdmin ? "Admin" : "Usuario"}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Staff Services</p>
              <h2>Oportunidades recientes</h2>
            </div>
            <span className="panel-chip">
              {status === "loading"
                ? "Cargando"
                : `${opportunities.length} items`}
            </span>
          </div>
          <div className="compact-list">
            {opportunities.slice(0, 5).map((opportunity) => (
              <article key={opportunity.opportunityId}>
                <span className={`status-dot ${opportunity.status}`} />
                <div>
                  <strong>{opportunity.title}</strong>
                  <small>
                    {opportunity.area} · {opportunity.serviceModel}
                  </small>
                </div>
                <em>{statusLabels[opportunity.status]}</em>
              </article>
            ))}
            {opportunities.length === 0 ? (
              <EmptyState
                icon={<Database />}
                text="Aun no hay oportunidades creadas."
                title="Sin oportunidades registradas"
              />
            ) : null}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Operación</p>
              <h2>Proximos frentes</h2>
            </div>
          </div>
          <div className="work-list">
            <WorkItem
              icon={<ClipboardList />}
              label="Solicitudes comerciales"
              state="Pendiente API"
            />
            <WorkItem
              icon={<CalendarDays />}
              label="Agenda y seguimiento"
              state="Planificado"
            />
            <WorkItem
              icon={<Activity />}
              label="Actividad interna"
              state="Planificado"
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function OpportunitiesModule() {
  const [editingOpportunityId, setEditingOpportunityId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState(initialOpportunityForm);
  const [opportunities, setOpportunities] = useState<StaffOpportunity[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [statusFilter, setStatusFilter] = useState<
    "all" | StaffOpportunityStatus
  >("all");
  const isEditing = Boolean(editingOpportunityId);

  const counters = useMemo(
    () =>
      opportunities.reduce(
        (accumulator, opportunity) => {
          accumulator[opportunity.status] += 1;
          return accumulator;
        },
        {
          active: 0,
          closed: 0,
          draft: 0,
          paused: 0,
        } satisfies Record<StaffOpportunityStatus, number>,
      ),
    [opportunities],
  );

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesStatus =
      statusFilter === "all" || opportunity.status === statusFilter;
    const searchable = [
      opportunity.title,
      opportunity.area,
      opportunity.serviceModel,
      opportunity.summary,
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  });
  const requirementCount = parseOpportunityRequirements(
    form.requirements,
  ).length;

  async function loadOpportunities() {
    setStatus("loading");

    try {
      const response = await listStaffOpportunities();
      setOpportunities(response.opportunities);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar oportunidades.",
        "error",
      );
    }
  }

  useEffect(() => {
    void loadOpportunities();
  }, []);

  function resetOpportunityForm() {
    setEditingOpportunityId(null);
    setForm(initialOpportunityForm);
  }

  function handleEdit(opportunity: StaffOpportunity) {
    setEditingOpportunityId(opportunity.opportunityId);
    setForm(toOpportunityForm(opportunity));
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);
    const payloadRequirements = payload.requirements ?? [];

    if (payload.summary.length > opportunitySummaryMaxLength) {
      setStatus("error");
      notifyToast(
        `La descripción no puede superar ${opportunitySummaryMaxLength} caracteres.`,
        "error",
      );
      return;
    }

    if (form.requirements.length > opportunityRequirementsMaxLength) {
      setStatus("error");
      notifyToast(
        `Los requisitos no pueden superar ${opportunityRequirementsMaxLength} caracteres en total.`,
        "error",
      );
      return;
    }

    if (payloadRequirements.length > opportunityRequirementsMaxItems) {
      setStatus("error");
      notifyToast(
        `Puedes registrar hasta ${opportunityRequirementsMaxItems} requisitos principales.`,
        "error",
      );
      return;
    }

    setStatus("saving");

    try {
      if (editingOpportunityId) {
        const response = await updateStaffOpportunity(
          editingOpportunityId,
          payload,
        );

        setOpportunities((currentOpportunities) =>
          currentOpportunities.map((opportunity) =>
            opportunity.opportunityId === editingOpportunityId
              ? response.opportunity
              : opportunity,
          ),
        );
        resetOpportunityForm();
        notifyToast("Oportunidad actualizada.", "success");
        setStatus("idle");
        return;
      }

      await createStaffOpportunity(payload);
      resetOpportunityForm();
      notifyToast("Oportunidad creada.", "success");
      await loadOpportunities();
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error
          ? error.message
          : "No se pudo crear la oportunidad.",
        "error",
      );
    }
  }

  async function handleStatusChange(
    opportunityId: string,
    nextStatus: StaffOpportunityStatus,
  ) {
    setStatus("saving");

    try {
      const response = await updateStaffOpportunity(opportunityId, {
        status: nextStatus,
      });
      setOpportunities((currentOpportunities) =>
        currentOpportunities.map((opportunity) =>
          opportunity.opportunityId === opportunityId
            ? response.opportunity
            : opportunity,
        ),
      );
      notifyToast("Estado actualizado.", "success");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado.",
        "error",
      );
    }
  }

  return (
    <section className="module-stack">
      <ModuleHeader
        action={
          <button
            className="secondary-button"
            disabled={status === "loading" || status === "saving"}
            onClick={loadOpportunities}
            type="button"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        }
        description="Gestiona oportunidades internas antes de publicarlas en un portal de empleos."
        kicker="Backoffice comercial"
        title="Staff Services"
      />
      <div className="metric-grid">
        {Object.entries(statusLabels).map(([key, label]) => (
          <MetricCard
            key={key}
            icon={<BriefcaseBusiness />}
            label={label}
            value={counters[key as StaffOpportunityStatus]}
          />
        ))}
      </div>
      <div className="workbench-grid">
        <form className="panel form-panel" onSubmit={handleCreate}>
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">
                {isEditing ? "Edición de oportunidad" : "Nueva oportunidad"}
              </p>
              <h2>{isEditing ? "Editar campos" : "Datos base"}</h2>
            </div>
            {isEditing ? (
              <button
                className="secondary-button compact"
                onClick={resetOpportunityForm}
                type="button"
              >
                <X size={16} />
                Cancelar
              </button>
            ) : null}
          </div>
          <TextField
            label="Título"
            onChange={(value) =>
              setForm((current) => ({ ...current, title: value }))
            }
            placeholder="Ej. Senior Data Engineer"
            value={form.title}
          />
          <div className="form-grid">
            <SelectField
              label="Área"
              onChange={(value) =>
                setForm((current) => ({ ...current, area: value }))
              }
              options={areas}
              value={form.area}
            />
            <SelectField
              label="Modelo"
              onChange={(value) =>
                setForm((current) => ({ ...current, serviceModel: value }))
              }
              options={serviceModels}
              value={form.serviceModel}
            />
            <SelectField
              label="Seniority"
              onChange={(value) =>
                setForm((current) => ({ ...current, seniority: value }))
              }
              options={seniorities}
              value={form.seniority}
            />
            <SelectField
              label="Modalidad"
              onChange={(value) =>
                setForm((current) => ({ ...current, modality: value }))
              }
              options={modalities}
              value={form.modality}
            />
          </div>
          <TextField
            label="Ubicación"
            onChange={(value) =>
              setForm((current) => ({ ...current, location: value }))
            }
            value={form.location}
          />
          <TextareaField
            counter={`${form.summary.length}/${opportunitySummaryMaxLength}`}
            hint="Describe el alcance con foco en lo que necesita el cliente."
            label="Descripción"
            maxLength={opportunitySummaryMaxLength}
            onChange={(value) =>
              setForm((current) => ({ ...current, summary: value }))
            }
            rows={4}
            value={form.summary}
          />
          <TextareaField
            counter={`${requirementCount}/${opportunityRequirementsMaxItems} requisitos`}
            hint={`Un requisito por línea. Máximo ${opportunityRequirementsMaxItems} requisitos.`}
            label="Requisitos principales"
            maxLength={opportunityRequirementsMaxLength}
            onChange={(value) =>
              setForm((current) => ({ ...current, requirements: value }))
            }
            placeholder="Un requisito por línea"
            rows={4}
            value={form.requirements}
          />
          <button
            className="primary-button"
            disabled={status === "saving"}
            type="submit"
          >
            {isEditing ? <Check size={18} /> : <Plus size={18} />}
            {status === "saving"
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Crear oportunidad"}
          </button>
        </form>
        <section className="panel table-panel">
          <div className="panel-title-row wrap">
            <div>
              <p className="eyebrow">Gestión</p>
              <h2>Oportunidades</h2>
            </div>
            <div className="table-tools">
              <div className="search-box compact">
                <Search size={17} />
                <input
                  aria-label="Buscar oportunidades"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar"
                  value={query}
                />
              </div>
              <select
                aria-label="Filtrar por estado"
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | StaffOpportunityStatus,
                  )
                }
                value={statusFilter}
              >
                <option value="all">Todos</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {status === "loading" ? (
            <TableMessage text="Cargando oportunidades..." />
          ) : null}
          {filteredOpportunities.length === 0 && status !== "loading" ? (
            <EmptyState
              icon={<Database />}
              text="Crea la primera oportunidad o ajusta los filtros."
              title="Sin oportunidades visibles"
            />
          ) : null}
          <div className="opportunity-list">
            {filteredOpportunities.map((opportunity) => (
              <article
                className="opportunity-row"
                key={opportunity.opportunityId}
              >
                <div className="opportunity-summary">
                  <span className={`status-pill ${opportunity.status}`}>
                    {statusLabels[opportunity.status]}
                  </span>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.summary || "Sin descripción registrada."}</p>
                  <dl>
                    <div>
                      <dt>Área</dt>
                      <dd>{opportunity.area}</dd>
                    </div>
                    <div>
                      <dt>Modelo</dt>
                      <dd>{opportunity.serviceModel}</dd>
                    </div>
                    <div>
                      <dt>Modalidad</dt>
                      <dd>{opportunity.modality || "Por definir"}</dd>
                    </div>
                    <div>
                      <dt>Actualizada</dt>
                      <dd>{formatDate(opportunity.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="opportunity-actions">
                  <button
                    className="secondary-button compact"
                    disabled={status === "saving"}
                    onClick={() => handleEdit(opportunity)}
                    type="button"
                  >
                    <FileText size={16} />
                    Editar campos
                  </button>
                  <label className="status-control">
                    <span>Estado</span>
                    <select
                      aria-label={`Cambiar estado de ${opportunity.title}`}
                      disabled={status === "saving"}
                      onChange={(event) =>
                        handleStatusChange(
                          opportunity.opportunityId,
                          event.target.value as StaffOpportunityStatus,
                        )
                      }
                      value={opportunity.status}
                    >
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function ApplicationsModule() {
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");

  const filteredApplications = applications.filter((application) => {
    const searchable = [
      application.firstName,
      application.lastName,
      application.rut,
      application.email,
      application.opportunityTitle,
      application.opportunityId,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query.trim().toLowerCase());
  });

  async function loadApplications() {
    setStatus("loading");

    try {
      const response = await listStaffApplications();
      setApplications(response.applications);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar postulantes.",
        "error",
      );
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  async function handleDownload(application: StaffApplication) {
    setDownloadId(application.applicationId);

    try {
      const cv = await downloadStaffApplicationCv(application.applicationId);
      saveBase64File(cv);
      notifyToast("CV descargado.", "success");
    } catch (error) {
      notifyToast(
        error instanceof Error ? error.message : "No se pudo descargar el CV.",
        "error",
      );
    } finally {
      setDownloadId(null);
    }
  }

  return (
    <section className="module-stack">
      <ModuleHeader
        action={
          <button
            className="secondary-button"
            disabled={status === "loading" || Boolean(downloadId)}
            onClick={loadApplications}
            type="button"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        }
        description="Consulta postulantes recibidos desde la web pública y descarga CVs privados para seguimiento interno."
        kicker="Base de postulantes"
        title="Postulantes"
      />
      <section className="panel table-panel">
        <div className="panel-title-row wrap">
          <div>
            <p className="eyebrow">Operación</p>
            <h2>Postulaciones recibidas</h2>
          </div>
          <div className="table-tools">
            <div className="search-box compact">
              <Search size={17} />
              <input
                aria-label="Buscar postulantes"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                value={query}
              />
            </div>
          </div>
        </div>

        {status === "loading" ? (
          <TableMessage text="Cargando postulantes..." />
        ) : null}
        {status !== "loading" && filteredApplications.length === 0 ? (
          <EmptyState
            icon={<Database />}
            text="Cuando alguien postule desde la web, aparecerá asociado a su oportunidad."
            title="Aún no hay postulantes visibles"
          />
        ) : null}

        {filteredApplications.length > 0 ? (
          <div className="data-table applications-table">
            <div className="table-row table-head applications-table-row">
              <div>Nombre</div>
              <div>Apellido</div>
              <div>RUT</div>
              <div>Empleo</div>
              <div>Fecha</div>
              <div>CV</div>
            </div>
            {filteredApplications.map((application) => (
              <div
                className="table-row applications-table-row"
                key={application.applicationId}
              >
                <div className="table-cell-stack">
                  <strong>{application.firstName}</strong>
                  <small>{application.email}</small>
                </div>
                <div className="table-cell-stack">
                  <strong>{application.lastName}</strong>
                  <small>{application.phone || "Sin teléfono"}</small>
                </div>
                <div>{application.rut}</div>
                <div className="table-cell-stack">
                  <strong>{application.opportunityTitle}</strong>
                  <small>{application.opportunityId}</small>
                </div>
                <div>{formatDate(application.submittedAt)}</div>
                <div>
                  <button
                    className="secondary-button compact"
                    disabled={downloadId === application.applicationId}
                    onClick={() => {
                      void handleDownload(application);
                    }}
                    type="button"
                  >
                    <Download size={16} />
                    {downloadId === application.applicationId
                      ? "Descargando"
                      : "Descargar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function SignatureModule() {
  const [values, setValues] = useState<SignatureValues>(defaultSignatureValues);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const signatureHtml = useMemo(() => buildSignatureHtml(values), [values]);

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
    setCopyStatus("idle");
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(signatureHtml);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  async function copySignature() {
    try {
      const ClipboardItemConstructor = window.ClipboardItem;

      if (!ClipboardItemConstructor) {
        await copyText();
        return;
      }

      await navigator.clipboard.write([
        new ClipboardItemConstructor({
          "text/html": new Blob([signatureHtml], { type: "text/html" }),
          "text/plain": new Blob([signatureHtml], { type: "text/plain" }),
        }),
      ]);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="module-stack">
      <ModuleHeader
        description="Genera firmas listas para copiar manteniendo el tamaño y marca corporativa."
        kicker="Marca interna"
        title="Generador de firmas"
      />
      <div className="workbench-grid">
        <form className="panel form-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Datos del miembro</p>
              <h2>Contenido editable</h2>
            </div>
            <button
              className="secondary-button"
              onClick={() => setValues(defaultSignatureValues)}
              type="button"
            >
              Restaurar
            </button>
          </div>
          <div className="form-grid">
            <InputField
              label="Nombre completo"
              name="fullName"
              onChange={handleInputChange}
              value={values.fullName}
            />
            <InputField
              label="Cargo o descripción"
              name="headline"
              onChange={handleInputChange}
              value={values.headline}
            />
            <InputField
              label="Teléfono"
              name="phone"
              onChange={handleInputChange}
              value={values.phone}
            />
            <InputField
              label="Sitio web"
              name="website"
              onChange={handleInputChange}
              value={values.website}
            />
          </div>
          <InputField
            label="LinkedIn"
            name="linkedin"
            onChange={handleInputChange}
            value={values.linkedin}
          />
          <div className="logo-url-field">
            <InputField
              label="Logo corporativo"
              name="logoUrl"
              onChange={handleInputChange}
              value={values.logoUrl}
            />
            <small>Se ajusta a {signatureLogoWidth}px de ancho.</small>
          </div>
          <TextareaInput
            label="Bajada comercial"
            name="tagline"
            onChange={handleInputChange}
            rows={4}
            value={values.tagline}
          />
        </form>
        <section className="panel signature-panel">
          <div className="panel-title-row wrap">
            <div>
              <p className="eyebrow">Preview en línea</p>
              <h2>Firma lista para copiar</h2>
            </div>
            <div className="copy-actions">
              <button
                className="secondary-button"
                onClick={copyText}
                type="button"
              >
                <Copy size={17} />
                Copiar HTML
              </button>
              <button
                className="primary-button"
                onClick={copySignature}
                type="button"
              >
                <Check size={17} />
                Copiar firma
              </button>
            </div>
          </div>
          <div className="signature-preview">
            <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
          </div>
          <textarea className="html-output" readOnly value={signatureHtml} />
          {copyStatus === "copied" ? (
            <InlineStatus kind="idle" message="Firma copiada." />
          ) : null}
          {copyStatus === "error" ? (
            <InlineStatus
              kind="error"
              message="No se pudo copiar desde el navegador."
            />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function UsersModule() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [users, setUsers] = useState<ResourceUser[]>([]);

  async function loadUsers() {
    setStatus("loading");

    try {
      const response = await listResourceUsers();
      setUsers(response.users);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error ? error.message : "No se pudo cargar usuarios.",
        "error",
      );
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      await inviteResourceUser(email, role);
      setEmail("");
      setRole("user");
      notifyToast("Usuario invitado.", "success");
      await loadUsers();
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error ? error.message : "No se pudo invitar usuario.",
        "error",
      );
    }
  }

  async function handleDisable(username: string) {
    setStatus("saving");

    try {
      await disableResourceUser(username);
      notifyToast("Usuario deshabilitado.", "success");
      await loadUsers();
    } catch (error) {
      setStatus("error");
      notifyToast(
        error instanceof Error
          ? error.message
          : "No se pudo deshabilitar usuario.",
        "error",
      );
    }
  }

  return (
    <section className="module-stack">
      <ModuleHeader
        action={
          <button
            className="secondary-button"
            onClick={loadUsers}
            type="button"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        }
        description="Administra accesos a EMAUS con cuentas corporativas."
        kicker="Administración"
        title="Usuarios internos"
      />
      <div className="users-layout">
        <form className="panel form-panel invite-panel" onSubmit={handleInvite}>
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Nuevo acceso</p>
              <h2>Invitar usuario</h2>
            </div>
          </div>
          <TextField
            label="Correo corporativo"
            onChange={setEmail}
            placeholder="usuario@cognitivebridge.cl"
            type="email"
            value={email}
          />
          <SelectField
            label="Rol"
            onChange={(value) => setRole(value as "admin" | "user")}
            options={[
              { label: "Usuario", value: "user" },
              { label: "Administrador", value: "admin" },
            ]}
            value={role}
          />
          <button
            className="primary-button"
            disabled={status === "saving"}
            type="submit"
          >
            <UserPlus size={18} />
            Invitar
          </button>
        </form>
        <section className="panel table-panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">Cognito</p>
              <h2>Usuarios registrados</h2>
            </div>
            <span className="panel-chip">{users.length} usuarios</span>
          </div>
          <div className="data-table">
            <div className="table-row table-head">
              <span>Correo</span>
              <span>Estado</span>
              <span>Creación</span>
              <span>Acción</span>
            </div>
            {status === "loading" ? (
              <TableMessage text="Cargando usuarios..." />
            ) : null}
            {users.map((user) => (
              <div className="table-row" key={user.username}>
                <span>{user.email || user.username}</span>
                <span>{user.enabled ? user.status : "DISABLED"}</span>
                <span>{formatDate(user.createdAt)}</span>
                <span>
                  <button
                    className="secondary-button danger compact"
                    disabled={!user.enabled || status === "saving"}
                    onClick={() => handleDisable(user.username)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    Deshabilitar
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PlaceholderModule({ kind }: { kind: "knowledge" | "requests" }) {
  const content =
    kind === "requests"
      ? {
          description:
            "Este módulo quedará conectado a la persistencia de solicitudes comerciales cuando expongamos el endpoint interno.",
          icon: <ClipboardList />,
          kicker: "Solicitudes",
          title: "Bandeja comercial",
        }
      : {
          description:
            "Aquí se concentrará documentación interna, decisiones y manuales operativos sincronizados con Notion.",
          icon: <FileText />,
          kicker: "Conocimiento",
          title: "Base interna",
        };

  return (
    <section className="module-stack">
      <ModuleHeader
        description={content.description}
        kicker={content.kicker}
        title={content.title}
      />
      <section className="panel placeholder-panel">
        {content.icon}
        <h2>Preparado para siguiente iteración</h2>
        <p>
          El espacio ya queda reservado dentro del backoffice para mantener una
          navegación estable mientras conectamos la API correspondiente.
        </p>
      </section>
    </section>
  );
}

function RestrictedModule({ module }: { module: ModuleDefinition }) {
  return (
    <section className="module-stack">
      <ModuleHeader
        description={module.description}
        kicker="Acceso restringido"
        title={module.label}
      />
      <section className="panel placeholder-panel">
        <Lock />
        <h2>Requiere permisos de administración</h2>
        <p>
          Si ya te agregaron al grupo `internal-admins`, cierra sesión y vuelve
          a ingresar para refrescar el token de Cognito.
        </p>
      </section>
    </section>
  );
}

function ModuleHeader({
  action,
  description,
  kicker,
  title,
}: {
  action?: ReactNode;
  description: string;
  kicker: string;
  title: string;
}) {
  return (
    <header className="module-header">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="module-actions">{action}</div> : null}
    </header>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WorkItem({
  icon,
  label,
  state,
}: {
  icon: ReactNode;
  label: string;
  state: string;
}) {
  return (
    <article className="work-item">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{state}</strong>
    </article>
  );
}

function EmptyState({
  icon,
  text,
  title,
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function InlineStatus({
  kind,
  message,
}: {
  kind: LoadStatus;
  message: string;
}) {
  return (
    <p className={`inline-status ${kind === "error" ? "error" : "success"}`}>
      {message}
    </p>
  );
}

function TableMessage({ text }: { text: string }) {
  return <p className="table-message">{text}</p>;
}

function TextField({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function TextareaField({
  counter,
  hint,
  label,
  maxLength,
  onChange,
  placeholder,
  rows,
  value,
}: {
  counter?: string;
  hint?: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
      {hint || counter ? (
        <span className="field-footer">
          <span>{hint}</span>
          <strong>{counter}</strong>
        </span>
      ) : null}
    </label>
  );
}

function InputField({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: keyof SignatureValues;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} onChange={onChange} value={value} />
    </label>
  );
}

function TextareaInput({
  label,
  name,
  onChange,
  rows,
  value,
}: {
  label: string;
  name: keyof SignatureValues;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} onChange={onChange} rows={rows} value={value} />
    </label>
  );
}

export default App;
