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
            name: 'Foundation Inspection',
            description: 'Inspect foundation work and structural integrity',
            assigned_to: 'supervisor',
            deadline: '2025-01-15',
            status: 'In Progress',
            progress: 80
          },
          {
            project_id: projects[0].id,
            name: 'Budget Review Meeting',
            description: 'Monthly budget review and expense analysis',
            assigned_to: 'accountant',
            deadline: '2025-01-18',
            status: 'Pending',
            progress: 0
          },
          {
            project_id: projects[1].id,
            name: 'Electrical Rough-in',
            description: 'Complete electrical rough-in for office spaces',
            assigned_to: 'supervisor',
            deadline: '2025-01-20',
            status: 'In Progress',
            progress: 45
          },
          {
            project_id: projects[1].id,
            name: 'Sales Report Preparation',
            description: 'Prepare quarterly sales performance report',
            assigned_to: 'salesperson',
            deadline: '2025-01-22',
            status: 'Pending',
            progress: 25
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