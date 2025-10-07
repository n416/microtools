import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8080/api',
});

apiClient.interceptors.request.use(
  (config) => {
    // ログイン認証用のトークンはlocalStorageから取得する形に戻します
    const token = localStorage.getItem('auth-token');
    
    console.log("【フロントエンド】APIリクエスト: ", config.url);
    console.log("【フロントエンド】認証トークン:", token ? 'あり' : 'なし');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;