# Build de la version web de l'app Expo, servie en statique par nginx.
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Les variables EXPO_PUBLIC_* sont inlinées dans le bundle : elles doivent
# exister au moment du build, pas au démarrage du conteneur.
ARG EXPO_PUBLIC_API_URL=https://trainwise-backend-rnd4.onrender.com
ARG EXPO_PUBLIC_DEMO=0
ARG EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
ARG EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_DEMO=$EXPO_PUBLIC_DEMO \
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID \
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

RUN npx expo export --platform web --output-dir dist

# Service
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
