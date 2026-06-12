import { useState } from 'react';
import { Dumbbell, UtensilsCrossed, Moon, Scale } from 'lucide-react';
import { WorkoutModal } from '@/components/body/WorkoutModal';
import { FoodEntryModal } from '@/components/energy/FoodEntryModal';
import { SleepEditModal } from '@/components/energy/SleepEditModal';
import { WeightLogModal } from '@/components/home/WeightLogModal';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useEnergy } from '@/hooks/useEnergy';
import type { Workout } from '@/types/workout';
import type { FoodEntry } from '@/types/energy';
import { toast } from '@/components/shared/ToastProvider';

const MENU_ITEMS = [
  { key: 'workout', label: 'Workout', icon: Dumbbell, bg: 'bg-info/10', color: 'text-info' },
  { key: 'food', label: 'Food', icon: UtensilsCrossed, bg: 'bg-terracotta/10', color: 'text-terracotta' },
  { key: 'sleep', label: 'Sleep', icon: Moon, bg: 'bg-gold/10', color: 'text-gold' },
  { key: 'weight', label: 'Weight', icon: Scale, bg: 'bg-primary/10', color: 'text-primary' },
] as const;

type MenuAction = (typeof MENU_ITEMS)[number]['key'];

interface QuickAddMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddMenu({ open, onOpenChange }: QuickAddMenuProps) {
  const [activeModal, setActiveModal] = useState<MenuAction | null>(null);

  const { addWorkout } = useWorkouts();
  const { addFoodEntry, addCheckIn, getCheckInByDate, updateCheckIn } = useEnergy();

  const handleSelect = (action: MenuAction) => {
    onOpenChange(false);
    setActiveModal(action);
  };

  const handleWorkoutSave = (workout: Omit<Workout, 'id'>) => {
    addWorkout(workout);
    toast.success('Workout added');
    setActiveModal(null);
  };

  const handleFoodSave = (entry: Omit<FoodEntry, 'id'>) => {
    addFoodEntry(entry);
    toast.success('Food entry added');
    setActiveModal(null);
  };

  const handleSleepSave = (hours: number) => {
    const todayCheckIn = getCheckInByDate(new Date());
    if (todayCheckIn) {
      updateCheckIn(todayCheckIn.id, { sleepHours: hours });
      toast.success('Sleep updated');
    } else {
      addCheckIn({ date: new Date(), sleepHours: hours });
      toast.success('Sleep logged');
    }
    setActiveModal(null);
  };

  const todayCheckIn = getCheckInByDate(new Date());

  return (
    <>
      {/* Bottom sheet backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-foreground/25 backdrop-blur-sm z-40 animate-in"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      {/* Bottom sheet menu */}
      {open && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-card-lg animate-fade-up"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          <div className="px-6 pt-3 pb-6">
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />
            <p className="font-display text-xl font-medium tracking-tight mb-5">Quick add</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="flex flex-col items-center gap-3 py-5 px-2 rounded-2xl border border-border bg-card hover:bg-muted/60 press"
                    onClick={() => handleSelect(item.key)}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <WorkoutModal
        open={activeModal === 'workout'}
        onOpenChange={(isOpen) => { if (!isOpen) setActiveModal(null); }}
        onSave={handleWorkoutSave}
      />

      <FoodEntryModal
        open={activeModal === 'food'}
        onOpenChange={(isOpen) => { if (!isOpen) setActiveModal(null); }}
        onSave={handleFoodSave}
      />

      <SleepEditModal
        open={activeModal === 'sleep'}
        onOpenChange={(isOpen) => { if (!isOpen) setActiveModal(null); }}
        onSave={handleSleepSave}
        currentHours={todayCheckIn?.sleepHours}
      />

      <WeightLogModal
        open={activeModal === 'weight'}
        onOpenChange={(isOpen) => { if (!isOpen) setActiveModal(null); }}
      />
    </>
  );
}
