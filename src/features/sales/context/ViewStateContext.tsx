import React, { createContext, useContext, useState, ReactNode } from 'react'
import { ViewMode, UnitType, UnitStatus, ProjectWithBuildings, BuildingWithUnits } from '../types'

interface ViewStateContextType {
  viewMode: ViewMode
  selectedProject: ProjectWithBuildings | null
  selectedBuilding: BuildingWithUnits | null
  activeUnitType: UnitType
  filterStatus: UnitStatus
  setViewMode: (mode: ViewMode) => void
  setSelectedProject: (project: ProjectWithBuildings | null) => void
  setSelectedBuilding: (building: BuildingWithUnits | null) => void
  setActiveUnitType: (type: UnitType) => void
  setFilterStatus: (status: UnitStatus) => void
  navigateToBuildings: (project: ProjectWithBuildings) => void
  navigateToUnits: (building: BuildingWithUnits) => void
  navigateToProjects: () => void
  navigateBackToBuildings: () => void
}

const ViewStateContext = createContext<ViewStateContextType | undefined>(undefined)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [selectedProject, setSelectedProject] = useState<ProjectWithBuildings | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingWithUnits | null>(null)
  const [activeUnitType, setActiveUnitType] = useState<UnitType>('apartment')
  const [filterStatus, setFilterStatus] = useState<UnitStatus>('all')

  const navigateToBuildings = (project: ProjectWithBuildings) => {
    setSelectedProject(project)
    setViewMode('buildings')
  }

  const navigateToUnits = (building: BuildingWithUnits) => {
    setSelectedBuilding(building)
    setViewMode('units')
  }

  const navigateToProjects = () => {
    setViewMode('projects')
    setSelectedProject(null)
    setSelectedBuilding(null)
  }

  const navigateBackToBuildings = () => {
    setViewMode('buildings')
    setSelectedBuilding(null)
  }

  return (
    <ViewStateContext.Provider
      value={{
        viewMode,
        selectedProject,
        selectedBuilding,
        activeUnitType,
        filterStatus,
        setViewMode,
        setSelectedProject,
        setSelectedBuilding,
        setActiveUnitType,
        setFilterStatus,
        navigateToBuildings,
        navigateToUnits,
        navigateToProjects,
        navigateBackToBuildings
      }}
    >
      {children}
    </ViewStateContext.Provider>
  )
}

export function useViewState() {
  const context = useContext(ViewStateContext)
  if (context === undefined) {
    throw new Error('useViewState must be used within a ViewStateProvider')
  }
  return context
}
