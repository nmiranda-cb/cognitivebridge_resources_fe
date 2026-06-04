import { Amplify } from "aws-amplify";
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  resetPassword,
  resendSignUpCode,
  signIn,
  signOut as amplifySignOut,
  signUp,
} from "aws-amplify/auth";

export interface AuthSession {
  accessToken: string;
  authorizationToken: string;
  email: string;
  groups: string[];
  idToken?: string;
  username: string;
}

export type SignInResult =
  | { session: AuthSession; status: "signed-in" }
  | { status: "new-password" }
  | { status: "reset-password" };

export type SignUpResult =
  | { status: "confirmed"; username: string }
  | { status: "confirmation-required"; username: string };

export type StaffOpportunityStatus = "active" | "closed" | "draft" | "paused";

export interface StaffOpportunity {
  area: string;
  createdAt: string;
  createdBy: string;
  location: string;
  modality: string;
  opportunityId: string;
  requirements: string[];
  seniority: string;
  serviceModel: string;
  status: StaffOpportunityStatus;
  summary: string;
  title: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StaffOpportunityPayload {
  area: string;
  location?: string;
  modality?: string;
  requirements?: string[];
  seniority?: string;
  serviceModel: string;
  status?: StaffOpportunityStatus;
  summary: string;
  title: string;
}

export interface ResourceUser {
  createdAt: string | null;
  email: string;
  enabled: boolean;
  status: string;
  updatedAt: string | null;
  username: string;
}

const authConfig = {
  allowedEmailDomain: "cognitivebridge.cl",
  userPoolClientId: "5or5l7f3psl4rqivh4hpmqjgpt",
  userPoolId: "us-east-1_eWNsRYSgM",
};

const resourcesApiBaseUrl = (
  import.meta.env.VITE_RESOURCES_API_BASE_URL ?? ""
).replace(/\/$/, "");

Amplify.configure({
  Auth: {
    Cognito: {
      loginWith: {
        email: true,
      },
      userPoolClientId: authConfig.userPoolClientId,
      userPoolId: authConfig.userPoolId,
    },
  },
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertCorporateEmail(email: string) {
  if (!normalizeEmail(email).endsWith(`@${authConfig.allowedEmailDomain}`)) {
    throw new Error("Usa un correo corporativo de CognitiveBridge.");
  }
}

function parseGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((group): group is string => typeof group === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .replace(/^\[|\]$/g, "")
    .split(/[\s,]+/)
    .map((group) => group.trim())
    .filter(Boolean);
}

function toReadableAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "No se pudo completar la autenticación.";
  }

  const errorMap: Record<string, string> = {
    CodeMismatchException: "El código ingresado no es válido.",
    ExpiredCodeException: "El código expiró. Solicita uno nuevo.",
    InvalidPasswordException:
      "La contraseña no cumple la política definida para el portal.",
    LimitExceededException:
      "Se superó el límite de intentos. Intenta nuevamente más tarde.",
    NotAuthorizedException: "Correo o contraseña incorrectos.",
    PasswordResetRequiredException:
      "Debes restablecer tu contraseña antes de ingresar.",
    UserNotConfirmedException:
      "Debes confirmar tu correo corporativo antes de ingresar.",
    UserNotFoundException: "No existe una cuenta interna para ese correo.",
    UsernameExistsException: "Ya existe una cuenta interna para ese correo.",
  };

  return errorMap[error.name] ?? error.message;
}

async function buildCurrentSession(): Promise<AuthSession | null> {
  const [authSession, currentUser, attributes] = await Promise.all([
    fetchAuthSession(),
    getCurrentUser(),
    fetchUserAttributes(),
  ]);
  const accessToken = authSession.tokens?.accessToken;
  const idToken = authSession.tokens?.idToken;
  const emailFromIdToken =
    typeof idToken?.payload.email === "string" ? idToken.payload.email : "";
  const email = normalizeEmail(attributes.email ?? emailFromIdToken);

  if (!accessToken || !email) {
    return null;
  }

  assertCorporateEmail(email);

  return {
    accessToken: accessToken.toString(),
    authorizationToken: idToken?.toString() ?? accessToken.toString(),
    email,
    groups: [
      ...new Set([
        ...parseGroups(idToken?.payload["cognito:groups"]),
        ...parseGroups(accessToken.payload["cognito:groups"]),
      ]),
    ],
    idToken: idToken?.toString(),
    username: currentUser.username,
  };
}

export async function getStoredSession() {
  try {
    return await buildCurrentSession();
  } catch {
    return null;
  }
}

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<SignInResult> {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    const result = await signIn({
      options: {
        authFlowType: "USER_SRP_AUTH",
      },
      password,
      username,
    });

    if (result.isSignedIn) {
      const session = await buildCurrentSession();

      if (!session) {
        throw new Error("Cognito no devolvió una sesión válida.");
      }

      return {
        session,
        status: "signed-in",
      };
    }

    if (
      result.nextStep.signInStep ===
      "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
    ) {
      return { status: "new-password" };
    }

    if (result.nextStep.signInStep === "RESET_PASSWORD") {
      return { status: "reset-password" };
    }

    throw new Error(
      `Flujo de autenticación no soportado: ${result.nextStep.signInStep}`,
    );
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function completeNewPassword(
  newPassword: string,
): Promise<AuthSession> {
  try {
    const result = await confirmSignIn({
      challengeResponse: newPassword,
    });

    if (!result.isSignedIn) {
      throw new Error(
        `Flujo de autenticación no soportado: ${result.nextStep.signInStep}`,
      );
    }

    const session = await buildCurrentSession();

    if (!session) {
      throw new Error("Cognito no devolvió una sesión válida.");
    }

    return session;
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function registerWithCredentials(
  fullName: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    const result = await signUp({
      options: {
        userAttributes: {
          email: username,
          name: fullName.trim() || username,
        },
      },
      password,
      username,
    });

    return result.isSignUpComplete
      ? { status: "confirmed", username }
      : { status: "confirmation-required", username };
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function confirmRegistration(email: string, code: string) {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    await confirmSignUp({
      confirmationCode: code.trim(),
      username,
    });
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function resendRegistrationCode(email: string) {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    await resendSignUpCode({ username });
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function startPasswordReset(email: string) {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    await resetPassword({ username });
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function finishPasswordReset(
  email: string,
  code: string,
  newPassword: string,
) {
  const username = normalizeEmail(email);
  assertCorporateEmail(username);

  try {
    await confirmResetPassword({
      confirmationCode: code.trim(),
      newPassword,
      username,
    });
  } catch (error) {
    throw new Error(toReadableAuthError(error));
  }
}

export async function signOut() {
  await amplifySignOut();
}

function apiUrl(path: string) {
  return `${resourcesApiBaseUrl}/api/v1/resources${path}`;
}

async function resourcesRequest<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const session = await getStoredSession();

  if (!session) {
    throw new Error("La sesión interna expiró. Vuelve a iniciar sesión.");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      Authorization: `Bearer ${session.authorizationToken}`,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;

    throw new Error(toReadableResourcesError(message));
  }

  return response.json() as Promise<TResponse>;
}

function toReadableResourcesError(message?: string) {
  if (!message) {
    return "No se pudo completar la operación.";
  }

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("requirements must contain no more than")) {
    return "Puedes registrar hasta 12 requisitos principales.";
  }

  return message;
}

export async function listResourceUsers() {
  return resourcesRequest<{ users: ResourceUser[] }>("/users");
}

export async function inviteResourceUser(
  email: string,
  role: "admin" | "user",
) {
  return resourcesRequest<{ invited: boolean; user: ResourceUser | null }>(
    "/users/invite",
    {
      body: JSON.stringify({ email, role }),
      method: "POST",
    },
  );
}

export async function disableResourceUser(username: string) {
  return resourcesRequest<{ disabled: boolean; username: string }>(
    `/users/${encodeURIComponent(username)}`,
    {
      method: "DELETE",
    },
  );
}

export async function listStaffOpportunities() {
  return resourcesRequest<{ opportunities: StaffOpportunity[] }>(
    "/admin/opportunities",
  );
}

export async function createStaffOpportunity(payload: StaffOpportunityPayload) {
  return resourcesRequest<{ opportunity: StaffOpportunity }>(
    "/admin/opportunities",
    {
      body: JSON.stringify(payload),
      method: "POST",
    },
  );
}

export async function updateStaffOpportunity(
  opportunityId: string,
  payload: Partial<StaffOpportunityPayload>,
) {
  return resourcesRequest<{ opportunity: StaffOpportunity }>(
    `/admin/opportunities/${encodeURIComponent(opportunityId)}`,
    {
      body: JSON.stringify(payload),
      method: "PATCH",
    },
  );
}
