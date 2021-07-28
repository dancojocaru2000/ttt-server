FROM node:alpine AS build
WORKDIR /var/app
COPY package.json package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:alpine
WORKDIR /var/app
COPY --from=build /var/app/package.json .
RUN npm install --production
COPY --from=build /var/app/*.json ./
COPY --from=build /var/app/public ./public
COPY --from=build /var/app/out ./out
CMD [ "npm", "start" ]
