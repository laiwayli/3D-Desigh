// Use system fonts to keep the downloadable, offline HTML compact.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
