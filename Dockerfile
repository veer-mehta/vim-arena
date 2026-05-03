FROM node:24.3.0

WORKDIR /

COPY /package*.json /

# for building
RUN npm i

COPY . .

ENV PORT=8080
ENV VITE_GOOGLE_CLIENT_ID=675023092647-fcgm5ctsp396577393q6pqbvv54t448p.apps.googleusercontent.com
ENV VITE_API_URL=http://backend:3000

EXPOSE 8080

# for starting
CMD [ "npm", "run", "dev", "--", "--host" ]