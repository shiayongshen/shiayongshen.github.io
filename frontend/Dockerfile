# 第一階段：建置 (Build)
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 第二階段：運行 (Nginx 伺服器)
FROM nginx:alpine
# 將建置好的靜態檔案放到 Nginx 目錄
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
