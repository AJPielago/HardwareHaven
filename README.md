# ShopApp - React Native Mobile Application

A full-featured e-commerce mobile app built with **React Native (Expo)** and **Node.js/Express/MongoDB** backend.

## Features

### MP1 - Product/Service CRUD (20pts)
- Create, Read, Update, Delete products/services
- Upload photos from gallery or camera
- Admin-only product management

### MP2 - User Functions (20pts)
- User registration & login with Firebase email/password
- Profile update with avatar upload (gallery/camera)
- Google social login via expo-auth-session + Firebase Auth credential sign-in

### MP3 - Review Ratings (20pts)
- Verified purchase review system (only delivered orders)
- Star rating (1-5) with comments
- Users can update their own reviews

### MP4 - SQLite Cart (20pts)
- Cart stored in SQLite (expo-sqlite)
- Cart persists across app restarts
- Cart cleared after successful checkout

### Term Test - Transactions (35pts)
- Complete checkout flow with order creation
- Admin can update order status (pending → confirmed → processing → shipped → delivered)
- Push notifications sent on status update
- Tap notification to view order details

### Quiz 1 - Search & Filters (15pts)
- Text search across product name/description
- Filter by category
- Filter by price range (min/max)
- Sort by price, rating, name, newest

### Quiz 2 - Notifications (15pts)
- Admin can send promotion/discount push notifications to all users
- View notification details with deep linking

### Quiz 3 - Redux (15pts)
- Redux Toolkit for state management
- Slices: auth, products, orders, reviews, cart, notifications

### Unit 1 - UI Design (20pts)
- Drawer navigation with user profile header
- Clean Material Design using react-native-paper
- Admin-specific drawer items

### Unit 2 - Backend Auth (20pts)
- Node.js/Express REST API
- Firebase ID token verification in backend middleware
- Push tokens saved per user with stale token cleanup

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone

### 1. Backend Setup

```bash
cd ShopApp/backend
npm install
```

Create `.env` file (already created):
```
PORT=5000
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Seed the database:
```bash
npm run seed
```

Start the server:
```bash
npm start
```

### 2. Frontend Setup

```bash
cd ShopApp
npm install
```

Create `.env` in the app root:
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Google login setup notes:
- In Firebase Console -> Authentication -> Sign-in method, enable `Google`.
- In Google Cloud Console, create OAuth client IDs as needed and place them in your env:
	- Web client -> `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
	- Android client -> `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
	- iOS client -> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- Restart Expo after env updates: `npx expo start -c`.

**Configure API URL** in `src/api/config.js`:
- Android Emulator: `http://10.0.2.2:5000/api`
- iOS Simulator: `http://localhost:5000/api`
- Physical Device: `http://YOUR_COMPUTER_IP:5000/api`

Email/password auth now runs through Firebase Auth on the client.

Start the app:
```bash
npx expo start
```

### 4. Standalone APK with Render Backend (No Local Terminal Needed)

Deploy backend to Render:

1. Push this repo to GitHub.
2. In Render, create a Blueprint service from the repository.
3. Render will detect `render.yaml` and create `shopapp-backend`.
4. Set required backend env vars in Render:
	- `MONGODB_URI`
	- `FIREBASE_PROJECT_ID`
	- `FIREBASE_CLIENT_EMAIL`
	- `FIREBASE_PRIVATE_KEY`
	- `JWT_SECRET`
	- optional cloud/email vars if used (`CLOUDINARY_*`, `SMTP_*`)
5. Wait for deploy success, then copy your backend URL:
	- Example: `https://shopapp-backend.onrender.com`

Bind backend URL to EAS build environments:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://shopapp-backend.onrender.com --environment preview
eas env:create --name EXPO_PUBLIC_API_URL --value https://shopapp-backend.onrender.com --environment production
```

Build standalone APK:

```bash
npx eas build -p android --profile preview --clear-cache
```

Notes:
- `eas.json` profiles now use EAS server environments (`development`, `preview`, `production`).
- Standalone builds now require `EXPO_PUBLIC_API_URL`; localhost fallback is disabled for release/standalone mode.

### 3. Test Accounts (after seeding)

| Role  | Email              | Password |
|-------|--------------------|----------|
| Admin | admin@shopapp.com  | admin123 |
| User  | john@example.com   | user123  |

---

## Project Structure

```
ShopApp/
├── App.js                          # Entry point (Redux Provider, Paper, Navigation)
├── app.json                        # Expo configuration
├── src/
│   ├── api/
│   │   └── config.js               # Axios instance with JWT interceptors
│   ├── store/
│   │   ├── index.js                # Redux store configuration
│   │   └── slices/
│   │       ├── authSlice.js        # Auth state (login, register, profile)
│   │       ├── productSlice.js     # Product CRUD state
│   │       ├── orderSlice.js       # Order management state
│   │       ├── reviewSlice.js      # Review/rating state
│   │       ├── cartSlice.js        # SQLite cart state
│   │       └── notificationSlice.js# Notification state
│   ├── navigation/
│   │   ├── AppNavigator.js         # Root navigator (auth check)
│   │   ├── AuthNavigator.js        # Login/Register stack
│   │   ├── DrawerNavigator.js      # Main drawer navigation
│   │   └── HomeNavigator.js        # Product stack navigator
│   ├── screens/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── reviews/
│   │   ├── notifications/
│   │   └── admin/
│   └── utils/
│       └── notifications.js        # Push notification helpers
├── backend/
│   ├── server.js                   # Express server
│   ├── .env                        # Environment variables
│   ├── seed.js                     # Database seeder
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   └── upload.js               # Multer file upload middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Review.js
│   │   ├── Order.js
│   │   └── Notification.js
│   └── routes/
│       ├── auth.js
│       ├── products.js
│       ├── reviews.js
│       ├── orders.js
│       └── notifications.js
```

## Tech Stack

- **Frontend:** React Native, Expo SDK 55, React Navigation (Drawer), Redux Toolkit, React Native Paper
- **Backend:** Node.js, Express, MongoDB/Mongoose, JWT, Multer
- **Storage:** expo-sqlite (cart)
- **Notifications:** expo-notifications, expo-server-sdk
- **Auth:** Firebase Auth (client), Firebase Admin (backend token verification)
