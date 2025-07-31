import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router'
import { createRoot } from 'react-dom/client'
import "./assets/globals.css";

import DefaultLayout from './layouts/Default.tsx'
import App from './App.tsx'
import Play from './pages/play/page.tsx';
import About from './pages/about/page.tsx';
import Tests from './pages/tests/page.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<DefaultLayout />}>
          <Route index element={<App />} />
          <Route path="/about" element={<About />} />
          <Route path="/play" element={<Play />} />
          <Route path="/tests" element={<Tests />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
