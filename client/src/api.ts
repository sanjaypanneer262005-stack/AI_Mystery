import axios from 'axios';

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
export const api=axios.create({baseURL:`${apiBaseUrl}/api`,withCredentials:true});
