# CognitiveBridge EMAUS FE

Frontend privado para `resources.cognitivebridge.cl`.

## Proposito

Aplicacion React + Vite para operar EMAUS, el backoffice interno de
CognitiveBridge:

- Dashboard operativo.
- Backoffice Staff Services.
- Generador de firmas.
- Administracion de usuarios internos.

## Tecnologias

| Capa          | Tecnologia                 |
| ------------- | -------------------------- |
| Frontend      | React + TypeScript         |
| Build         | Vite                       |
| Autenticacion | AWS Amplify Auth + Cognito |
| Iconografia   | lucide-react               |
| Alertas       | SweetAlert2                |
| Hosting       | S3 + CloudFront            |

## Autenticacion y API

El login usa Cognito User Pool `cognitivebridge-resources-users`.

El consumo de `/api/v1/resources/*` usa el `idToken` como bearer token para que
el backend reciba identidad Cognito con `email`, `sub`, `cognito:username` y
`cognito:groups`.

## Uso local

```bash
npm install
npm run dev
```

Si se requiere apuntar a un backend distinto al mismo dominio:

```bash
VITE_RESOURCES_API_BASE_URL=https://api.example.com npm run dev
```

## Build

```bash
npm run build
```
