# Outplay

Outplay is an Ionic and Angular app for discovering the biggest rating upsets from major chess tournaments. It combines Lichess broadcast data, ranks decisive games by Elo gap, and links directly to the original games.

The same codebase runs in a browser and as an Android or iOS app through Capacitor.

## Features

- Account registration and login with token-based authentication
- Protected app routes and persistent sessions
- Chess events from a PHP API backed by Lichess broadcasts
- Filters for event section, round, and rated or unrated players
- Games ranked by the rating gap between winner and opponent
- Direct links to replay games on Lichess
- Saved sample games when the backend is unavailable
- Native Android and iOS projects powered by Capacitor

## Tech stack

- Angular 22
- Ionic 9
- Capacitor 8
- TypeScript 6
- RxJS
- SCSS
- Jasmine and Karma
- ESLint

## Requirements

- Node.js `^22.22.3`, `^24.15.0`, or `>=26.0.0`
- npm
- A compatible PHP API for authentication and chess data
- Optional: Android Studio and the Android SDK for Android development
- Optional: macOS with Xcode for iOS development

The included `npm start` command expects XAMPP's PHP executable at `/opt/lampp/bin/php` and the API files under `/opt/lampp/htdocs`. If your PHP setup is elsewhere, start the API separately and use `npm run start:web` for the frontend.

## Getting started

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Configure the API URL in the environment files:

   ```text
   src/environments/environment.ts
   src/environments/environment.prod.ts
   ```

3. Start the app:

   ```bash
   npm start
   ```

   This launches the local PHP server at `http://127.0.0.1:8000` and the Angular development server. The PHP server log is written to `/tmp/outplay-php-api.log`.

4. Open the URL printed by Angular, normally `http://localhost:4200`.

To run only the web frontend:

```bash
npm run start:web
```

## Backend API

Outplay expects `environment.apiUrl` to point to a PHP API with these endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/login.php` | Authenticate a user and return a token and user record |
| `POST` | `/create_user.php` | Register a new user |
| `GET` | `/chess/upsets.php` | Return decisive games and broadcast metadata |

Authenticated requests include the token as an `Authorization: Bearer <token>` header.

The development environment currently uses:

```text
http://127.0.0.1:8000/php-api
```

The production environment currently uses Android Emulator's host alias:

```text
http://10.0.2.2:8000/php-api
```

Before deploying, replace the production value with the HTTPS URL of the deployed API.

### Device networking

- Browser on the development computer: use `127.0.0.1` or `localhost`.
- Android Emulator: use `10.0.2.2` to reach the host computer.
- Physical Android or iOS device: use the development computer's LAN IP, such as `http://192.168.1.100:8000/php-api`. The device and computer must be on the same network, and the API must listen on `0.0.0.0`.

To expose the included XAMPP API server to a device, run:

```bash
npm run api:android
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the XAMPP PHP API and Angular development server together |
| `npm run start:web` | Start only the Angular development server |
| `npm run api` | Start the PHP API on `127.0.0.1:8000` |
| `npm run api:android` | Start the PHP API on `0.0.0.0:8000` for emulator or device access |
| `npm run build` | Create a production web build in `www/` |
| `npm run watch` | Rebuild continuously using the development configuration |
| `npm test` | Run unit tests with Karma |
| `npm run lint` | Lint TypeScript and HTML files |

## Native development

Build the web app and sync it to the native projects:

```bash
npm run build
npx cap sync
```

Open a native project:

```bash
npx cap open android
npx cap open ios
```

You can also run directly on a configured target:

```bash
npx cap run android
npx cap run ios
```

iOS builds require macOS and Xcode.

## Project structure

```text
src/app/
├── guards/                 Route protection
├── login/                  Login page
├── register/               Account registration page
├── services/
│   ├── auth.service.ts     Authentication and session storage
│   ├── auth.interceptor.ts Bearer-token HTTP interceptor
│   ├── chess-events.service.ts
│   └── photo.service.ts    Capacitor camera/filesystem service
├── tab1/                   Outplay home page
├── tab2/                   Chess event and upset explorer
└── tabs/                   Tab shell and child routes

src/environments/           Development and production API settings
android/                    Capacitor Android project
ios/                        Capacitor iOS project
scripts/start-dev.sh        Combined PHP and Angular development launcher
```

## Troubleshooting

### Login or registration fails

Confirm that the PHP server is running, `environment.apiUrl` points to the correct host, and the API allows requests from the app's origin. Check `/tmp/outplay-php-api.log` when using `npm start`.

### A phone cannot reach the API

Do not use `localhost` from a physical device. Use the computer's LAN IP, run `npm run api:android`, and ensure the firewall permits inbound traffic on port `8000`.

### Native changes do not appear

Rebuild and sync the web assets:

```bash
npm run build
npx cap sync
```

## License

See [LICENSE](LICENSE).
