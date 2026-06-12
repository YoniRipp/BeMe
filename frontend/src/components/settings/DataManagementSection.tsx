import { Database, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { queryKeys } from '@/lib/queryClient';
import { exportAllData, downloadFile } from '@/lib/export';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { toast } from '@/components/shared/ToastProvider';
import { SettingsSection } from './SettingsSection';

interface DataManagementSectionProps {
  onResetClick: () => void;
  onClearClick: () => void;
}

export function DataManagementSection({ onResetClick, onClearClick }: DataManagementSectionProps) {
  const queryClient = useQueryClient();

  const handleExportData = () => {
    try {
      const workouts = (queryClient.getQueryData(queryKeys.workouts) as import('@/types/workout').Workout[]) ?? [];
      const foodEntries = (queryClient.getQueryData(queryKeys.foodEntries) as import('@/types/energy').FoodEntry[]) ?? [];
      const checkIns = (queryClient.getQueryData(queryKeys.checkIns) as import('@/types/energy').DailyCheckIn[]) ?? [];
      const dataStr = exportAllData({
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        workouts,
        foodEntries,
        checkIns,
        settings: storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS,
      });
      downloadFile(dataStr, `trackvibe-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success('Data exported successfully');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not export data. Please try again.');
    }
  };

  return (
    <SettingsSection icon={Database} title="Data Management" iconColor="text-red-600">
      <div className="space-y-3">
        <Button onClick={handleExportData} variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Export All Data
        </Button>
        <Button onClick={onResetClick} variant="outline" className="w-full">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset Settings to Defaults
        </Button>
        <Button onClick={onClearClick} variant="destructive" className="w-full">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Data
        </Button>
      </div>
    </SettingsSection>
  );
}
