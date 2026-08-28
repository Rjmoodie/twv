import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/safe-area.css'

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(<App />);
