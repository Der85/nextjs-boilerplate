'use client'

interface Step {
  id: string
  label: string
}

interface StepProgressProps {
  steps: Step[]
  currentStep: string
  showLabels?: boolean
}

export default function StepProgress({ 
  steps, 
  currentStep, 
  showLabels = true 
}: StepProgressProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep)
  const currentLabel = steps[currentIndex]?.label || ''
  
  return (
    <div className="space-y-2">
      {/* Step label */}
      {showLabels && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-700">
            {currentLabel}
          </span>
          <span className="text-sm text-slate-500">
            {currentIndex + 1} of {steps.length}
          </span>
        </div>
      )}
      
      {/* Progress bar */}
      <div 
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={`Step ${currentIndex + 1} of ${steps.length}: ${currentLabel}`}
      >
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              index <= currentIndex 
                ? 'bg-teal-500' 
                : 'bg-slate-200'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
