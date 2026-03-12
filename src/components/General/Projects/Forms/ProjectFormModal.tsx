import React from 'react'
import { Modal, FormField, Input, Select, Button, Alert } from '../../../ui'
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

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={projectId ? 'Edit Project' : 'New Project'}
        onClose={onClose}
      />
      <Modal.Body>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Project Name" required className="md:col-span-2">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Kozara Residential Complex"
                required
              />
            </FormField>

            <FormField label="Location" required className="md:col-span-2">
              <Input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Zagreb, Croatia"
                required
              />
            </FormField>

            <FormField label="Start Date" required>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </FormField>

            <FormField label="End Date (Optional)">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </FormField>

            <FormField label="Budget (EUR)" required>
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
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
        </form>
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
            <Button onClick={handleSubmit} disabled={loading} loading={loading}>
              {projectId ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  )
}

export default ProjectFormModal
