FROM python:3.13-slim

WORKDIR /app

# 安裝依賴
COPY pyproject.toml .
RUN pip install .

# 複製程式碼
COPY backend ./backend
COPY content ./content

# 宣告對外 Port
EXPOSE 8080

# 啟動指令 (因為使用 pip install --no-cache-dir，uvicorn 會被安裝在全域路徑)
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]