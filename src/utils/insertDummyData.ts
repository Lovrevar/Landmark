import { supabase } from '../lib/supabase'

export const insertDummyData = async () => {
  try {
    console.log('Starting dummy data insertion...')

    // Insert Projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .insert([
        {
          name: 'Sunset Towers Residential Complex',
          location: 'Los Angeles, CA',
          start_date: '2024-03-15',
          end_date: '2025-08-30',
          budget: 15000000,
          investor: 'Pacific Real Estate Group',
          status: 'In Progress'
        },
        {
          name: 'Green Valley Office Park',
          location: 'Austin, TX',
          start_date: '2024-06-01',
          end_date: '2025-12-15',
          budget: 8500000,
          investor: 'Texas Development Corp',
          status: 'In Progress'
        },
        {
          name: 'Marina Bay Shopping Center',
          location: 'San Diego, CA',
          start_date: '2023-01-10',
          end_date: '2024-10-20',
          budget: 12000000,
          investor: 'Coastal Investments LLC',
          status: 'Completed'
        },
        {
          name: 'Tech Campus Phase 1',
          location: 'Seattle, WA',
          start_date: '2025-02-01',
          end_date: '2026-11-30',
          budget: 22000000,
          investor: 'Innovation Partners',
          status: 'Planning'
        }
      ])
      .select()

    if (projectsError) {
      console.error('Error inserting projects:', projectsError)
      return false
    }

    console.log('Projects inserted:', projects)

    // Insert Subcontractors
    const { data: subcontractors, error: subError } = await supabase
      .from('subcontractors')
      .insert([
        {
          name: 'Elite Electrical Solutions',
          contact: 'mike@eliteelectrical.com',
          job_description: 'Complete electrical installation and wiring for residential complex',
          progress: 75,
          deadline: '2025-03-15',
          cost: 450000
        },
        {
          name: 'Premier Plumbing Co',
          contact: 'sarah@premierplumbing.com',
          job_description: 'Plumbing installation and water systems setup',
          progress: 60,
          deadline: '2025-02-28',
          cost: 320000
        },
        {
          name: 'Advanced HVAC Systems',
          contact: 'john@advancedhvac.com',
          job_description: 'HVAC installation and climate control systems',
          progress: 40,
          deadline: '2025-04-10',
          cost: 280000
        }
      ])
      .select()

    if (subError) {
      console.error('Error inserting subcontractors:', subError)
    } else {
      console.log('Subcontractors inserted:', subcontractors)
    }

    // Insert Tasks (using project IDs)
    if (projects && projects.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .insert([
          {
            project_id: projects[0].id,
            name: 'Foundation Quality Control',
            description: 'Conduct comprehensive foundation inspection and structural integrity assessment',
            assigned_to: 'supervisor',
            created_by: 'director',
            deadline: '2024-09-15',
            status: 'In Progress',
            progress: 75
          },
          {
            project_id: projects[0].id,
            name: 'Q3 Financial Review',
            description: 'Quarterly budget analysis and expense reconciliation for Sunset Towers',
            assigned_to: 'accountant',
            created_by: 'director',
            deadline: '2024-09-20',
            status: 'In Progress',
            progress: 60
          },
          {
            project_id: projects[0].id,
            name: 'Apartment Sales Campaign',
            description: 'Launch marketing campaign for remaining units in Sunset Towers',
            assigned_to: 'salesperson',
            created_by: 'director',
            deadline: '2024-09-25',
            status: 'Pending',
            progress: 30
          },
          {
            project_id: projects[0].id,
            name: 'Project Status Report',
            description: 'Compile comprehensive project status report for stakeholders',
            assigned_to: 'director',
            created_by: 'director',
            deadline: '2024-09-30',
            status: 'Pending',
            progress: 10
          },
          {
            project_id: projects[1].id,
            name: 'HVAC System Installation',
            description: 'Oversee HVAC system installation and testing for office spaces',
            assigned_to: 'supervisor',
            created_by: 'director',
            deadline: '2024-09-18',
            status: 'In Progress',
            progress: 85
          },
          {
            project_id: projects[1].id,
            name: 'Office Space Pre-leasing',
            description: 'Initiate pre-leasing activities for Green Valley Office Park',
            assigned_to: 'salesperson',
            created_by: 'director',
            deadline: '2024-09-22',
            status: 'In Progress',
            progress: 40
          },
          {
            project_id: projects[1].id,
            name: 'Contractor Payment Processing',
            description: 'Process payments for completed work phases',
            assigned_to: 'accountant',
            created_by: 'director',
            deadline: '2024-09-12',
            status: 'Completed',
            progress: 100
          },
          {
            project_id: projects[1].id,
            name: 'Environmental Compliance Review',
            description: 'Review environmental compliance and sustainability measures',
            assigned_to: 'director',
            created_by: 'director',
            deadline: '2024-09-28',
            status: 'Pending',
            progress: 0
          },
          {
            project_id: projects[2].id,
            name: 'Final Inspection Coordination',
            description: 'Coordinate final inspections for Marina Bay Shopping Center',
            assigned_to: 'supervisor',
            created_by: 'director',
            deadline: '2024-09-10',
            status: 'Completed',
            progress: 100
          },
          {
            project_id: projects[2].id,
            name: 'Tenant Move-in Coordination',
            description: 'Coordinate tenant move-in schedules and logistics',
            assigned_to: 'salesperson',
            created_by: 'director',
            deadline: '2024-09-14',
            status: 'In Progress',
            progress: 70
          },
          {
            project_id: projects[2].id,
            name: 'Final Cost Analysis',
            description: 'Complete final cost analysis and project closure documentation',
            assigned_to: 'accountant',
            created_by: 'director',
            deadline: '2024-09-16',
            status: 'In Progress',
            progress: 90
          },
          {
            project_id: projects[3].id,
            name: 'Site Preparation Planning',
            description: 'Develop comprehensive site preparation plan for Tech Campus',
            assigned_to: 'director',
            created_by: 'director',
            deadline: '2024-09-26',
            status: 'In Progress',
            progress: 35
          },
          {
            project_id: projects[3].id,
            name: 'Permit Application Review',
            description: 'Review and submit all required construction permits',
            assigned_to: 'supervisor',
            created_by: 'director',
            deadline: '2024-09-24',
            status: 'Pending',
            progress: 20
          },
          {
            project_id: projects[3].id,
            name: 'Budget Allocation Planning',
            description: 'Plan budget allocation for Tech Campus Phase 1',
            assigned_to: 'accountant',
            created_by: 'director',
            deadline: '2024-09-29',
            status: 'Pending',
            progress: 15
          },
          {
            project_id: projects[3].id,
            name: 'Investor Presentation Prep',
            description: 'Prepare presentation materials for investor meeting',
            assigned_to: 'salesperson',
            created_by: 'director',
            deadline: '2024-09-27',
            status: 'Pending',
            progress: 5
          }
        ])
        .select()

      if (tasksError) {
        console.error('Error inserting tasks:', tasksError)
      } else {
        console.log('Tasks inserted:', tasks)
      }

      // Insert Apartments (for residential project)
      const { data: apartments, error: apartmentsError } = await supabase
        .from('apartments')
        .insert([
          {
            project_id: projects[0].id,
            number: 'A101',
            floor: 1,
            size_m2: 85.5,
            price: 450000,
            status: 'Sold',
            buyer_name: 'John Smith'
          },
          {
            project_id: projects[0].id,
            number: 'A102',
            floor: 1,
            size_m2: 92.0,
            price: 485000,
            status: 'Available'
          },
          {
            project_id: projects[0].id,
            number: 'A201',
            floor: 2,
            size_m2: 78.5,
            price: 425000,
            status: 'Reserved'
          },
          {
            project_id: projects[0].id,
            number: 'A202',
            floor: 2,
            size_m2: 95.0,
            price: 510000,
            status: 'Sold',
            buyer_name: 'Maria Garcia'
          }
        ])
        .select()

      if (apartmentsError) {
        console.error('Error inserting apartments:', apartmentsError)
      } else {
        console.log('Apartments inserted:', apartments)
      }
    }

    // Insert Invoices
    if (projects && projects.length > 0 && subcontractors && subcontractors.length > 0) {
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .insert([
          {
            project_id: projects[0].id,
            subcontractor_id: subcontractors[0].id,
            amount: 125000,
            due_date: '2025-01-30',
            paid: false
          },
          {
            project_id: projects[0].id,
            subcontractor_id: subcontractors[1].id,
            amount: 85000,
            due_date: '2025-01-15',
            paid: true
          },
          {
            project_id: projects[1].id,
            subcontractor_id: subcontractors[2].id,
            amount: 95000,
            due_date: '2025-02-05',
            paid: false
          }
        ])
        .select()

      if (invoicesError) {
        console.error('Error inserting invoices:', invoicesError)
      } else {
        console.log('Invoices inserted:', invoices)
      }
    }

    console.log('Dummy data insertion completed successfully!')
    return true

  } catch (error) {
    console.error('Error in insertDummyData:', error)
    return false
  }
}