import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/context/NotificationContext';
import { SettingsSection } from './SettingsSection';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/pushSubscription';

export function NotificationsSection() {
  const {
    preferences,
    updatePreferences,
    permission,
    requestPermission,
    testNotification,
  } = useNotifications();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (FEATURE_FLAGS.PWA_PUSH_NOTIFICATIONS) {
      isPushSubscribed().then(setPushEnabled);
    }
  }, []);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        const sub = await subscribeToPush();
        setPushEnabled(sub !== null);
      }
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <SettingsSection icon={Bell} title="Notifications" iconColor="text-info">
      <div className="space-y-4">
        {permission === 'default' && (
          <div className="p-3 bg-gold/10 border border-gold/30 rounded-lg">
            <p className="text-sm text-foreground mb-2">
              Enable browser notifications to receive reminders
            </p>
            <Button onClick={requestPermission} size="sm">
              Enable Notifications
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-foreground">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          </div>
        )}

        {permission === 'granted' && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label id="notif-enabled-label">Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive daily reminders for logging food and sleep
                </p>
              </div>
              <Switch
                checked={preferences.enabled}
                onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
                aria-labelledby="notif-enabled-label"
              />
            </div>

            {preferences.enabled && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label id="notif-food-label">Food Logging Reminder</Label>
                    <Switch
                      checked={preferences.logFoodReminder}
                      onCheckedChange={(checked) =>
                        updatePreferences({ logFoodReminder: checked })
                      }
                      aria-labelledby="notif-food-label"
                    />
                  </div>
                  {preferences.logFoodReminder && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={preferences.logFoodReminderTime.hours}
                        onChange={(e) =>
                          updatePreferences({
                            logFoodReminderTime: {
                              ...preferences.logFoodReminderTime,
                              hours: parseInt(e.target.value) || 20,
                            },
                          })
                        }
                        placeholder="Hour"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={preferences.logFoodReminderTime.minutes}
                        onChange={(e) =>
                          updatePreferences({
                            logFoodReminderTime: {
                              ...preferences.logFoodReminderTime,
                              minutes: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        placeholder="Minute"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label id="notif-sleep-label">Sleep Logging Reminder</Label>
                    <Switch
                      checked={preferences.logSleepReminder}
                      onCheckedChange={(checked) =>
                        updatePreferences({ logSleepReminder: checked })
                      }
                      aria-labelledby="notif-sleep-label"
                    />
                  </div>
                  {preferences.logSleepReminder && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={preferences.logSleepReminderTime.hours}
                        onChange={(e) =>
                          updatePreferences({
                            logSleepReminderTime: {
                              ...preferences.logSleepReminderTime,
                              hours: parseInt(e.target.value) || 22,
                            },
                          })
                        }
                        placeholder="Hour"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={preferences.logSleepReminderTime.minutes}
                        onChange={(e) =>
                          updatePreferences({
                            logSleepReminderTime: {
                              ...preferences.logSleepReminderTime,
                              minutes: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        placeholder="Minute"
                      />
                    </div>
                  )}
                </div>

                <Button onClick={testNotification} variant="outline" size="sm">
                  Test Notification
                </Button>

                {FEATURE_FLAGS.PWA_PUSH_NOTIFICATIONS && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications even when the app is closed
                        </p>
                      </div>
                      <Button
                        onClick={handlePushToggle}
                        disabled={pushLoading}
                        variant={pushEnabled ? 'destructive' : 'default'}
                        size="sm"
                      >
                        {pushLoading ? 'Loading...' : pushEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  );
}
