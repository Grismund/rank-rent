import { useState, useEffect } from 'preact/hooks'
import type { ComponentType } from 'preact'

interface ToolRouterProps {
  toolType: string
  phone?: string
  ctaPrimary?: string
  state?: string
  city?: string
}

type ToolComponent = ComponentType<Omit<ToolRouterProps, 'toolType'>>

const TOOL_MAP: Record<string, () => Promise<{ default: ToolComponent }>> = {
  'epoxy-cost-estimator': () => import('./epoxy-cost-estimator'),
  'bath-budget-estimator': () => import('./bath-budget-estimator'),
  'tint-law-and-cost': () => import('./tint-law-and-cost'),
  'load-size-estimator': () => import('./load-size-estimator'),
  'kitchen-budget-estimator': () => import('./kitchen-budget-estimator'),
  'pool-cost-estimator': () => import('./pool-cost-estimator'),
  'paver-sealing-estimator': () => import('./paver-sealing-estimator'),
  'surface-cost-estimator': () => import('./surface-cost-estimator'),
}

export default function ToolRouter(props: ToolRouterProps) {
  const { toolType, ...rest } = props
  const [Tool, setTool] = useState<ToolComponent | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loader = TOOL_MAP[toolType]
    if (!loader) {
      setError(true)
      return
    }
    loader()
      .then((mod) => setTool(() => mod.default))
      .catch(() => setError(true))
  }, [toolType])

  if (error) {
    return <p>Calculator unavailable. Call for a free estimate.</p>
  }

  if (!Tool) {
    return null // ToolShell's loading state already visible
  }

  return <Tool {...rest} />
}
