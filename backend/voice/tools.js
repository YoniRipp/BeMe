/** Voice function declarations for Gemini Function Calling. Schema types use OpenAPI/JSON Schema values. */
export const VOICE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'add_workout',
        description: 'Log a workout. When the user does not give a workout name use title "Workout". When they say a program name (e.g. SS, Starting Strength) use that as title. When the user says they did a SAVED/NAMED workout without listing exercises (e.g. "I did Yoni\'s workout", "did my Monday routine") call add_workout with title set to that workout name and exercises: [] (empty array) so the app can copy from the user\'s saved workout. When they give overrides (e.g. "I did Yoni\'s workout with 150kg squat") use title = workout name and exercises = only the overrides (e.g. one exercise with name "Squat", weight: 150). Do not use an exercise name as the workout title. Examples: "ran 45 minutes", "did squats 5 sets of 3 at 140 kilos", "SS: squat 5x3 140kg deadlift 3x3 160kg". For strength with sets/reps/weight use type "strength" and fill the exercises array. durationMinutes is optional (default 30).',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            title: { type: 'string', description: 'Workout name: "Workout" when none given, or user\'s program/saved workout name (e.g. SS, Yoni\'s workout)' },
            type: { type: 'string', enum: ['strength', 'cardio', 'flexibility', 'sports'], description: 'Use strength when user mentions sets/reps/weight' },
            durationMinutes: { type: 'number', description: 'Optional; default 30' },
            notes: { type: 'string' },
            exercises: {
              type: 'array',
              description: 'For strength: list each exercise with name, sets, reps, weight (kg). For "I did [saved workout name]" with no exercises, use []. For overrides only (e.g. "with 150kg squat") include only the overridden exercise(s). Use sets x reps: "5 sets of 3 reps" -> sets: 5, reps: 3. Notation "3x3" means 3 sets of 3 reps.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Use the exact exercise name the user said, capitalized (e.g. Squat, Deadlift). Do not use the workout title here.' },
                  sets: { type: 'number', description: 'Number of sets' },
                  reps: { type: 'number', description: 'Reps per set' },
                  weight: { type: 'number', description: 'Weight in kg (optional)' },
                  notes: { type: 'string' },
                },
                required: ['name', 'sets', 'reps'],
              },
            },
          },
          required: ['title', 'type'],
        },
      },
      {
        name: 'edit_workout',
        description: 'Edit a logged workout. You can change title, type, duration, notes, date, or the exercises list. To change one exercise (e.g. "change squat to 5 sets", "remove deadlift", "add bench press 3x10 60kg"), pass the full exercises array with the updates. To replace or remove exercises, send the new list.',
        parameters: {
          type: 'object',
          properties: {
            workoutTitle: { type: 'string' },
            workoutId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['strength', 'cardio', 'flexibility', 'sports'] },
            durationMinutes: { type: 'number' },
            notes: { type: 'string' },
            exercises: {
              type: 'array',
              description: 'Full list of exercises (replaces existing). Each: name, sets, reps, weight (kg optional). Use when user asks to add, remove, or change an exercise.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number' },
                  reps: { type: 'number' },
                  weight: { type: 'number', description: 'Weight in kg (optional)' },
                  notes: { type: 'string' },
                },
                required: ['name', 'sets', 'reps'],
              },
            },
          },
        },
      },
      {
        name: 'delete_workout',
        description: 'Remove a SINGLE workout. To remove many or all workouts, use delete_workouts instead.',
        parameters: {
          type: 'object',
          properties: {
            workoutTitle: { type: 'string' },
            workoutId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
          },
        },
      },
      {
        name: 'delete_workouts',
        description: 'Delete MANY workouts at once. Use this (NOT repeated delete_workout calls) when the user asks to remove ALL their workouts, clear/reset/wipe their workout log, start a "clean slate", or delete a whole block/range of workouts. With no dates it deletes ALL of the user\'s workouts (past and future). Optionally restrict to an inclusive date range with from/to (YYYY-MM-DD). The tool returns the exact number deleted — report that number truthfully and never claim workouts were removed without calling this tool. Only call when the user explicitly asks to remove multiple or all workouts.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Optional inclusive start date YYYY-MM-DD. Omit to delete from the beginning.' },
            to: { type: 'string', description: 'Optional inclusive end date YYYY-MM-DD. Omit to delete through the end (including future workouts).' },
          },
        },
      },
      {
        name: 'add_food',
        description: 'Log food or drink consumed. Always pass amount and unit when the user says a quantity: e.g. "I ate three eggs" -> food=eggs, amount=3, unit=eggs; "100g chicken" -> food=chicken, amount=100, unit=g; "two apples" -> food=apple, amount=2, unit=apples. For countable items use unit=egg/eggs, apple/apples, slice/slices, piece/pieces, serving/servings so the app can show "3 eggs" not "100g". If the user says ONLY a food or drink name with no quantity (e.g. "coffee"), use amount=1 and unit=serving or leave default. Output food name in English. Times in HH:MM 24h.',
        parameters: {
          type: 'object',
          properties: {
            food: { type: 'string', description: 'Food name in English' },
            amount: { type: 'number', description: 'Quantity (e.g. 3 for three eggs, 100 for 100g)' },
            unit: { type: 'string', description: 'Unit: g, kg, ml, L, cup, slice, serving, egg/eggs, apple/apples, piece/pieces, etc. Use egg/eggs for eggs so it shows "3 eggs".' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Meal section when the user mentions or the client context provides breakfast, lunch, dinner, or snack.' },
            startTime: { type: 'string', description: 'Optional. Meal start time HH:MM 24h (e.g. 18:00). Use when user gives a time range for the meal.' },
            endTime: { type: 'string', description: 'Optional. Meal end time HH:MM 24h (e.g. 20:00). Use when user gives a time range for the meal.' },
          },
          required: ['food'],
        },
      },
      {
        name: 'edit_food_entry',
        description: 'Edit a logged food entry.',
        parameters: {
          type: 'object',
          properties: {
            foodName: { type: 'string' },
            entryId: { type: 'string' },
            date: { type: 'string' },
            name: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fats: { type: 'number' },
            mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          },
        },
      },
      {
        name: 'delete_food_entry',
        description: 'Remove a food log.',
        parameters: {
          type: 'object',
          properties: {
            foodName: { type: 'string' },
            entryId: { type: 'string' },
            date: { type: 'string' },
          },
        },
      },
      {
        name: 'log_sleep',
        description: 'Log sleep duration in hours. User may say slept 8 hours, slept 7, woke up from 6 to 8 (2 hours), etc.',
        parameters: {
          type: 'object',
          properties: {
            sleepHours: { type: 'number', description: 'Hours slept' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
          },
          required: ['sleepHours'],
        },
      },
      {
        name: 'edit_check_in',
        description: 'Update sleep hours for a date.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            sleepHours: { type: 'number' },
          },
          required: ['date', 'sleepHours'],
        },
      },
      {
        name: 'delete_check_in',
        description: 'Remove a sleep log.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['date'],
        },
      },
      {
        name: 'add_goal',
        description: 'Add a goal. E.g. 3 workouts per week, 2000 calories daily.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['calories', 'workouts', 'sleep'] },
            target: { type: 'number' },
            period: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] },
          },
          required: ['type', 'target', 'period'],
        },
      },
      {
        name: 'edit_goal',
        description: 'Edit a goal.',
        parameters: {
          type: 'object',
          properties: {
            goalType: { type: 'string' },
            goalId: { type: 'string' },
            target: { type: 'number' },
            period: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] },
          },
        },
      },
      {
        name: 'delete_goal',
        description: 'Remove a goal.',
        parameters: {
          type: 'object',
          properties: {
            goalType: { type: 'string' },
            goalId: { type: 'string' },
          },
        },
      },

      // ─── Weight tracking ──────────────────────────────────────
      {
        name: 'log_weight',
        description: 'Log body weight. E.g. "I weigh 72.5 kg", "72 kilos today".',
        parameters: {
          type: 'object',
          properties: {
            weightKg: { type: 'number', description: 'Body weight in kg' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            notes: { type: 'string' },
          },
          required: ['weightKg'],
        },
      },
      {
        name: 'edit_weight',
        description: 'Edit a logged weight entry.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
            weightKg: { type: 'number' },
            notes: { type: 'string' },
          },
        },
      },
      {
        name: 'delete_weight',
        description: 'Remove a weight entry.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
          },
        },
      },

      // ─── Water tracking ───────────────────────────────────────
      {
        name: 'add_water',
        description: 'Log water intake. E.g. "I drank 3 glasses of water", "had water". Default 1 glass.',
        parameters: {
          type: 'object',
          properties: {
            glasses: { type: 'number', description: 'Number of glasses (default 1)' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
          },
        },
      },
      {
        name: 'remove_water',
        description: 'Remove a glass of water from today\'s log.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
          },
        },
      },

      // ─── Cycle tracking ───────────────────────────────────────
      {
        name: 'log_cycle',
        description: 'Log a cycle/period entry. E.g. "My period started", "log period start heavy flow".',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            periodStart: { type: 'boolean', description: 'Whether this marks the start of a period' },
            flow: { type: 'string', enum: ['light', 'medium', 'heavy'], description: 'Flow intensity' },
            symptoms: { type: 'string', description: 'Comma-separated symptoms' },
            notes: { type: 'string' },
          },
        },
      },
      {
        name: 'edit_cycle',
        description: 'Edit a logged cycle entry.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
            periodStart: { type: 'boolean' },
            flow: { type: 'string', enum: ['light', 'medium', 'heavy'] },
            symptoms: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
      {
        name: 'delete_cycle',
        description: 'Remove a cycle entry.',
        parameters: {
          type: 'object',
          properties: {
            entryId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD for disambiguation' },
          },
        },
      },

      // ─── Profile ──────────────────────────────────────────────
      {
        name: 'update_profile',
        description: 'Update user profile info. E.g. "update my height to 175", "set target weight to 70 kg".',
        parameters: {
          type: 'object',
          properties: {
            heightCm: { type: 'number', description: 'Height in centimetres' },
            currentWeight: { type: 'number', description: 'Current weight in kg' },
            targetWeight: { type: 'number', description: 'Target weight in kg' },
            activityLevel: { type: 'string', enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'], description: 'Activity level' },
            sex: { type: 'string', enum: ['male', 'female', 'other'], description: 'Sex' },
          },
        },
      },

      // ─── Trainer ──────────────────────────────────────────────
      {
        name: 'add_client_workout',
        description: 'Trainer: log a workout for a named client. Use clientName for the client\'s name (first or full name). Use clientTraineeNumber for their roster number when the trainer says "Guy number 4" or "client 4". When multiple clients share the same first name, the system will ask for the full name or number — in that case, use both clientName (full name) and/or clientTraineeNumber.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name (e.g. "Guy" or "Guy Malka")' },
            clientId: { type: 'string', description: 'Client user ID if known' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation (e.g. 4 if trainer says "Guy number 4" or "trainee 4")' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            title: { type: 'string', description: 'Workout name' },
            type: { type: 'string', enum: ['strength', 'cardio', 'flexibility', 'sports'] },
            durationMinutes: { type: 'number', description: 'Optional; default 30' },
            exercises: {
              type: 'array',
              description: 'List of exercises with name, sets, reps, weight (kg).',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number' },
                  reps: { type: 'number' },
                  weight: { type: 'number', description: 'Weight in kg (optional)' },
                },
                required: ['name', 'sets', 'reps'],
              },
            },
          },
          required: ['title', 'type'],
        },
      },
      {
        name: 'edit_client_workout',
        description: 'Trainer: edit a client\'s existing workout. Use clientTraineeNumber when trainer identifies client by roster number.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name' },
            clientId: { type: 'string' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation' },
            workoutTitle: { type: 'string' },
            workoutId: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['strength', 'cardio', 'flexibility', 'sports'] },
            durationMinutes: { type: 'number' },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number' },
                  reps: { type: 'number' },
                  weight: { type: 'number' },
                },
                required: ['name', 'sets', 'reps'],
              },
            },
          },
        },
      },
      {
        name: 'delete_client_workout',
        description: 'Trainer: remove a client\'s workout.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name' },
            clientId: { type: 'string' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation' },
            workoutTitle: { type: 'string' },
            workoutId: { type: 'string' },
          },
        },
      },
      {
        name: 'add_client_food',
        description: 'Trainer: log food for a client. Use clientTraineeNumber when trainer identifies client by roster number.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name' },
            clientId: { type: 'string', description: 'Client user ID if known' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation' },
            food: { type: 'string', description: 'Food name in English' },
            amount: { type: 'number' },
            unit: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD, default today' },
            mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          },
          required: ['food'],
        },
      },
      {
        name: 'edit_client_food',
        description: 'Trainer: edit a client\'s food entry.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name' },
            clientId: { type: 'string' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation' },
            foodName: { type: 'string' },
            entryId: { type: 'string' },
            name: { type: 'string' },
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fats: { type: 'number' },
          },
        },
      },
      {
        name: 'delete_client_food',
        description: 'Trainer: remove a client\'s food entry.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Client first name or full name' },
            clientId: { type: 'string' },
            clientTraineeNumber: { type: 'number', description: 'Client roster number for disambiguation' },
            foodName: { type: 'string' },
            entryId: { type: 'string' },
          },
        },
      },
    ],
  },
];
