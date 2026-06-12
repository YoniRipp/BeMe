import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { exportAllData, importAllData, exportToCSV, downloadFile } from '@/lib/export';
import { queryKeys } from '@/lib/queryClient';
import { useSettings } from '@/hooks/useSettings';
import { Download, Upload, FileJson, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';

interface DataExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataExportModal({ open, onOpenChange }: DataExportModalProps) {
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const handleExportJSON = () => {
    try {
      const workouts = (queryClient.getQueryData(queryKeys.workouts) as import('@/types/workout').Workout[]) ?? [];
      const foodEntries = (queryClient.getQueryData(queryKeys.foodEntries) as import('@/types/energy').FoodEntry[]) ?? [];
      const checkIns = (queryClient.getQueryData(queryKeys.checkIns) as import('@/types/energy').DailyCheckIn[]) ?? [];
      const data = exportAllData({
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        workouts,
        foodEntries,
        checkIns,
      });
      downloadFile(data, `trackvibe-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      toast.success('Data exported successfully!');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export data. Please try again.');
    }
  };

  const handleExportCSV = (type: 'workouts' | 'food') => {
    try {
      const csvData = {
        workouts: (queryClient.getQueryData(queryKeys.workouts) as import('@/types/workout').Workout[]) ?? [],
        foodEntries: (queryClient.getQueryData(queryKeys.foodEntries) as import('@/types/energy').FoodEntry[]) ?? [],
        units: settings.units,
      };
      const csv = exportToCSV(type, csvData);
      downloadFile(csv, `trackvibe-${type}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully!`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not export ${type}. Please try again.`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = importAllData(content);

        if (result.success) {
          toast.success('Data imported successfully! Please refresh the page.');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error(result.error || 'Could not import data. Please try again.');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not read file. Please try again.');
      } finally {
        setImporting(false);
        onOpenChange(false);
      }
    };

    reader.onerror = () => {
      toast.error('Could not read file. Please try again.');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export / Import Data</DialogTitle>
          <DialogDescription>
            Export your data as JSON or CSV, or import previously exported data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Export Data</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Export All Data (JSON)</p>
                    <p className="text-sm text-muted-foreground">
                      Export all your data in JSON format
                    </p>
                  </div>
                </div>
                <Button onClick={handleExportJSON} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-4 border rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm font-medium mb-1">Workouts</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCSV('workouts')}
                    className="w-full"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    CSV
                  </Button>
                </div>

                <div className="flex flex-col items-center p-4 border rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm font-medium mb-1">Food Entries</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCSV('food')}
                    className="w-full"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Import Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Import Data</h3>
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Warning: Importing will replace all existing data
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Make sure to export your current data before importing.
                  </p>
                </div>
              </div>
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
                <Button
                  asChild
                  variant="outline"
                  disabled={importing}
                  className="w-full"
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {importing ? 'Importing...' : 'Import JSON File'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
