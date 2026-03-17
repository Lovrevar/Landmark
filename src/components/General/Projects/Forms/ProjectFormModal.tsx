import React, { useState } from 'react'
import { Modal, FormField, Input, Select, Button, Alert, Form } from '../../../ui'
import { useProjectForm } from '../hooks/useProjectForm'

interface ProjectFormModalProps {
  projectId?: string | null
  onClose: () => void
  onSuccess: () => void
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ projectId, onClose, onSuccess }) => {
  const { form, setForm, loading, error, setError, handleSubmit, handleDelete } = useProjectForm(
    projectId,
    onSuccess,
    onSuccess
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleLocalSubmit = (e?: React.FormEvent) => {
    const errors: Record<string, string> = {}
    if (!form.name?.trim()) errors.name = 'Project name is required'
    if (!form.location?.trim()) errors.location = 'Location is required'
    if (!form.start_date) errors.start_date = 'Start date is required'
    if (!form.budget) errors.budget = 'Budget is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (e) handleSubmit(e)
  }

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={projectId ? 'Edit Project' : 'New Project'}
        onClose={onClose}
      />
      <Modal.Body>
        <Form onSubmit={(e) => handleLocalSubmit(e)}>
          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Project Name" required className="md:col-span-2" error={fieldErrors.name}>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Kozara Residential Complex"
              />
            </FormField>

            <FormField label="Location" required className="md:col-span-2" error={fieldErrors.location}>
              <Input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Zagreb, Croatia"
              />
            </FormField>

            <FormField label="Start Date" required error={fieldErrors.start_date}>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </FormField>

            <FormField label="End Date (Optional)">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </FormField>

            <FormField label="Budget (EUR)" required error={fieldErrors.budget}>
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </FormField>

            <FormField label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </Select>
            </FormField>


          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          {projectId && (
            <Button variant="danger" onClick={handleDelete} disabled={loading}>
              Delete Project
            </Button>
          )}
          <div className={`flex space-x-3 ${!projectId ? 'ml-auto' : ''}`}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => handleLocalSubmit()} disabled={loading} loading={loading}>
              {projectId ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  )
}

export default ProjectFormModal
