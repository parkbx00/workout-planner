import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, Route, Routes } from 'react-router-dom'
import ReloadPrompt from './components/ReloadPrompt.tsx'
import RestBar from './components/RestBar.tsx'
import TabBar from './components/TabBar.tsx'
import { getActiveSession } from './db/sessions.ts'
import { useWakeLock } from './lib/useWakeLock.ts'
import ExerciseHistory from './screens/ExerciseHistory.tsx'
import ExerciseForm from './screens/ExerciseForm.tsx'
import Exercises from './screens/Exercises.tsx'
import History from './screens/History.tsx'
import SessionDetail from './screens/SessionDetail.tsx'
import Settings from './screens/Settings.tsx'
import TemplateAddExercise from './screens/TemplateAddExercise.tsx'
import TemplateEditor from './screens/TemplateEditor.tsx'
import Templates from './screens/Templates.tsx'
import Today from './screens/Today.tsx'
import Workout from './screens/Workout.tsx'
import WorkoutPicker from './screens/WorkoutPicker.tsx'
import WorkoutSummary from './screens/WorkoutSummary.tsx'

export default function App() {
  // Keep the screen on for as long as a workout is in progress, whichever tab is showing.
  const workoutActive = useLiveQuery(async () => Boolean(await getActiveSession()), [])
  useWakeLock(workoutActive === true)

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/workout/add" element={<WorkoutPicker />} />
          <Route path="/workout/swap/:cardId" element={<WorkoutPicker />} />
          <Route path="/workout/summary/:id" element={<WorkoutSummary />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/edit/:id" element={<TemplateEditor />} />
          <Route path="/templates/edit/:id/add" element={<TemplateAddExercise />} />
          <Route path="/templates/exercises" element={<Exercises />} />
          <Route path="/templates/exercises/new" element={<ExerciseForm />} />
          <Route path="/templates/exercises/:id" element={<ExerciseForm />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/exercises" element={<History />} />
          <Route path="/history/stats" element={<History />} />
          <Route path="/history/session/:id" element={<SessionDetail />} />
          <Route path="/history/exercise/:id" element={<ExerciseHistory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ReloadPrompt />
      <RestBar />
      <TabBar />
    </div>
  )
}
