import axios from "axios";

export const http = axios.create({ baseURL: "/api", adapter: "fetch", timeout: 15_000 });

http.interceptors.response.use(undefined, (error) =>
  Promise.reject(
    new Error(error.response?.data?.error?.message ?? "Something went wrong. Try again."),
  ),
);
