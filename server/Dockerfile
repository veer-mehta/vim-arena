FROM node:24.3.0

WORKDIR /

COPY /package*.json /

# for building
RUN npm i

COPY . .

ENV MONGODB_URI=mongodb+srv://veermehta:VeerMehta314271@cluster0.dn3gk5k.mongodb.net/vim_arena?retryWrites=true&w=majority
ENV PORT=3000

EXPOSE 3000

# for starting
CMD [ "npm", "run", "dev" ]