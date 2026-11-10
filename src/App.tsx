import { Navigate, Route, Routes } from 'react-router-dom'
import ReloadPrompt from './components/ReloadPrompt.tsx'
import TabBar from './components/TabBar.tsx'
import ExerciseForm from './screens/ExerciseForm.tsx'
import Exercises from './screens/Exercises.tsx'
import History from './screens/History.tsx'
import Settings from './screens/Settings.tsx'
import Templates from './screens/Templates.tsx'
import Today from './screens/Today.tsx'
import Workout from './screens/Workout.tsx'

export default function App() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/exercises" element={<Exercises />} />
          <Route path="/templates/exercises/new" element={<ExerciseForm />} />
          <Route path="/templates/exercises/:id" element={<ExerciseForm />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ReloadPrompt />
      <TabBar />
    </div>
  )
}
