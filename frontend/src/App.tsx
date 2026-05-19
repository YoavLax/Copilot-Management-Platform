import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OverviewPage } from './pages/OverviewPage';
import { DetailedReportPage } from './pages/DetailedReportPage';
import { DataPipelinePage } from './pages/DataPipelinePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/report" element={<DetailedReportPage />} />
        <Route path="/ingestion" element={<DataPipelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
