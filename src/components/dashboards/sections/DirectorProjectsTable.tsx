import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Badge } from '../../ui'
import { useTranslation } from 'react-i18next'
import type { ProjectStats } from '../types/directorTypes'

interface Props {
  projects: ProjectStats[]
}

const DirectorProjectsTable: React.FC<Props> = ({ projects }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.projects_portfolio')}</h2>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">{projects.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.director.total_projects')}</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.project_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.status_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.budget_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.expenses_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.revenue_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.profit_margin_col')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.director.completion_col')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">{t('dashboards.director.no_projects')}</p>
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{project.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{project.location}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={
                      project.status === 'Completed' ? 'green' :
                      project.status === 'In Progress' ? 'blue' :
                      project.status === 'On Hold' ? 'red' : 'gray'
                    }>
                      {project.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €{(project.budget / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-red-600">
                    €{(project.total_expenses / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    €{(project.apartment_sales / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center text-sm font-semibold ${
                      project.profit_margin >= 20 ? 'text-green-600' :
                      project.profit_margin >= 10 ? 'text-blue-600' :
                      project.profit_margin >= 0 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {project.profit_margin >= 0 ? '+' : ''}{project.profit_margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${project.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {project.completion_percentage.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DirectorProjectsTable
