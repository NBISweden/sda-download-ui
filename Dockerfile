FROM node:24-alpine
USER node
WORKDIR /home/node
CMD ["sh", "-c", "npm install && npm run dev"]