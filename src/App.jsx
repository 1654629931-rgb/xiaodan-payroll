import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'salary-mobile-app-v1'

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

const getCurrentPeriod = () => {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const parseAmount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const createDefaultState = () => ({
  currentPeriod: getCurrentPeriod(),
  employees: [],
  tasks: [
    { id: uid(), name: '完成任务1', amount: 120, note: '示例任务，可直接修改或删除' },
    { id: uid(), name: '整理客户账目', amount: 80, note: '按次结算' },
    { id: uid(), name: '申报税务资料', amount: 150, note: '固定任务单价' },
  ],
  payrollRecords: [],
})

const loadAppState = () => {
  const fallback = createDefaultState()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw)
    return {
      currentPeriod: parsed.currentPeriod || fallback.currentPeriod,
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      tasks: Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : fallback.tasks,
      payrollRecords: Array.isArray(parsed.payrollRecords) ? parsed.payrollRecords : [],
    }
  } catch {
    return fallback
  }
}

const createEmptyRecord = (employeeId, period) => ({
  id: uid(),
  employeeId,
  period,
  taskIds: [],
  deductions: [],
  adjustments: [],
  directAdjustment: 0,
  note: '',
  updatedAt: new Date().toISOString(),
})

const getTaskAmountMap = (tasks) =>
  tasks.reduce((map, task) => {
    map[task.id] = parseAmount(task.amount)
    return map
  }, {})

const getTaskTotal = (record, tasks) => {
  const amountMap = getTaskAmountMap(tasks)
  return (record?.taskIds || []).reduce((sum, taskId) => sum + (amountMap[taskId] || 0), 0)
}

const getLineItemsTotal = (items) =>
  (items || []).reduce((sum, item) => sum + parseAmount(item.amount), 0)

const getRecordTotals = (record, tasks) => {
  const taskTotal = getTaskTotal(record, tasks)
  const deductionTotal = getLineItemsTotal(record?.deductions)
  const adjustmentTotal = getLineItemsTotal(record?.adjustments)
  const directAdjustment = parseAmount(record?.directAdjustment)
  const payable = taskTotal - deductionTotal + adjustmentTotal + directAdjustment

  return {
    taskTotal,
    deductionTotal,
    adjustmentTotal,
    directAdjustment,
    payable,
  }
}

const emptyEmployeeForm = {
  name: '',
  role: '',
  salaryAccount: '',
  phone: '',
  note: '',
}

const emptyTaskForm = {
  name: '',
  amount: '',
  note: '',
}

function App() {
  const [appState, setAppState] = useState(loadAppState)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriod())
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [taskForm, setTaskForm] = useState(emptyTaskForm)
  const [editingTaskId, setEditingTaskId] = useState('')

  const { employees, tasks, payrollRecords, currentPeriod } = appState

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))
  }, [appState])

  useEffect(() => {
    if (!employees.length) {
      setSelectedEmployeeId('')
      return
    }

    if (!employees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(employees[0].id)
    }
  }, [employees, selectedEmployeeId])

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  )

  const currentEditableRecord = useMemo(() => {
    if (!selectedEmployeeId || !selectedPeriod) {
      return null
    }

    return (
      payrollRecords.find(
        (record) =>
          record.employeeId === selectedEmployeeId && record.period === selectedPeriod,
      ) || createEmptyRecord(selectedEmployeeId, selectedPeriod)
    )
  }, [payrollRecords, selectedEmployeeId, selectedPeriod])

  const currentTotals = useMemo(
    () => getRecordTotals(currentEditableRecord, tasks),
    [currentEditableRecord, tasks],
  )

  const employeeSummaries = useMemo(
    () =>
      employees.map((employee) => {
        const records = payrollRecords.filter((record) => record.employeeId === employee.id)
        const currentRecord = records.find((record) => record.period === currentPeriod)
        const currentPayable = currentRecord ? getRecordTotals(currentRecord, tasks).payable : 0
        const cumulativePayable = records.reduce(
          (sum, record) => sum + getRecordTotals(record, tasks).payable,
          0,
        )

        return {
          ...employee,
          currentPayable,
          cumulativePayable,
          recordCount: records.length,
        }
      }),
    [employees, payrollRecords, currentPeriod, tasks],
  )

  const overviewStats = useMemo(() => {
    const currentPayroll = payrollRecords
      .filter((record) => record.period === currentPeriod)
      .reduce((sum, record) => sum + getRecordTotals(record, tasks).payable, 0)

    const cumulativePayroll = payrollRecords.reduce(
      (sum, record) => sum + getRecordTotals(record, tasks).payable,
      0,
    )

    return {
      employees: employees.length,
      tasks: tasks.length,
      currentPayroll,
      cumulativePayroll,
    }
  }, [employees.length, tasks.length, payrollRecords, currentPeriod, tasks])

  const selectedEmployeeRecords = useMemo(() => {
    if (!selectedEmployeeId) {
      return []
    }

    return payrollRecords
      .filter((record) => record.employeeId === selectedEmployeeId)
      .sort((a, b) => b.period.localeCompare(a.period))
  }, [payrollRecords, selectedEmployeeId])

  const updateAppState = (updater) => {
    setAppState((prev) => updater(prev))
  }

  const upsertRecord = (employeeId, period, updater) => {
    if (!employeeId || !period) {
      return
    }

    updateAppState((prev) => {
      const nextRecords = [...prev.payrollRecords]
      const targetIndex = nextRecords.findIndex(
        (record) => record.employeeId === employeeId && record.period === period,
      )
      const baseRecord =
        targetIndex >= 0
          ? nextRecords[targetIndex]
          : createEmptyRecord(employeeId, period)
      const draftRecord = updater(baseRecord)

      const nextRecord = {
        ...draftRecord,
        employeeId,
        period,
        directAdjustment: parseAmount(draftRecord.directAdjustment),
        updatedAt: new Date().toISOString(),
      }

      if (targetIndex >= 0) {
        nextRecords[targetIndex] = nextRecord
      } else {
        nextRecords.push(nextRecord)
      }

      return {
        ...prev,
        payrollRecords: nextRecords,
      }
    })
  }

  const handleEmployeeSubmit = (event) => {
    event.preventDefault()
    if (!employeeForm.name.trim()) {
      return
    }

    const nextId = editingEmployeeId || uid()

    updateAppState((prev) => {
      const payload = {
        id: nextId,
        name: employeeForm.name.trim(),
        role: employeeForm.role.trim(),
        salaryAccount: employeeForm.salaryAccount.trim(),
        phone: employeeForm.phone.trim(),
        note: employeeForm.note.trim(),
        updatedAt: new Date().toISOString(),
      }

      const nextEmployees = editingEmployeeId
        ? prev.employees.map((employee) =>
            employee.id === editingEmployeeId ? { ...employee, ...payload } : employee,
          )
        : [...prev.employees, payload]

      return {
        ...prev,
        employees: nextEmployees,
      }
    })

    setSelectedEmployeeId(nextId)
    setEmployeeForm(emptyEmployeeForm)
    setEditingEmployeeId('')
  }

  const handleEditEmployee = (employee) => {
    setActiveTab('employees')
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      name: employee.name || '',
      role: employee.role || '',
      salaryAccount: employee.salaryAccount || '',
      phone: employee.phone || '',
      note: employee.note || '',
    })
  }

  const handleDeleteEmployee = (employeeId) => {
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee) {
      return
    }

    const confirmed = window.confirm(`确认删除员工“${employee.name}”及其全部工资记录吗？`)
    if (!confirmed) {
      return
    }

    updateAppState((prev) => ({
      ...prev,
      employees: prev.employees.filter((employeeItem) => employeeItem.id !== employeeId),
      payrollRecords: prev.payrollRecords.filter((record) => record.employeeId !== employeeId),
    }))
  }

  const handleTaskSubmit = (event) => {
    event.preventDefault()
    if (!taskForm.name.trim()) {
      return
    }

    updateAppState((prev) => {
      const payload = {
        id: editingTaskId || uid(),
        name: taskForm.name.trim(),
        amount: parseAmount(taskForm.amount),
        note: taskForm.note.trim(),
      }

      const nextTasks = editingTaskId
        ? prev.tasks.map((task) => (task.id === editingTaskId ? payload : task))
        : [...prev.tasks, payload]

      return {
        ...prev,
        tasks: nextTasks,
      }
    })

    setTaskForm(emptyTaskForm)
    setEditingTaskId('')
  }

  const handleEditTask = (task) => {
    setActiveTab('tasks')
    setEditingTaskId(task.id)
    setTaskForm({
      name: task.name || '',
      amount: task.amount ?? '',
      note: task.note || '',
    })
  }

  const handleDeleteTask = (taskId) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) {
      return
    }

    const confirmed = window.confirm(`确认删除任务“${task.name}”吗？相关工资记录中的勾选也会一并移除。`)
    if (!confirmed) {
      return
    }

    updateAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((taskItem) => taskItem.id !== taskId),
      payrollRecords: prev.payrollRecords.map((record) => ({
        ...record,
        taskIds: record.taskIds.filter((id) => id !== taskId),
      })),
    }))
  }

  const handleTaskToggle = (taskId) => {
    upsertRecord(selectedEmployeeId, selectedPeriod, (record) => {
      const exists = record.taskIds.includes(taskId)
      return {
        ...record,
        taskIds: exists
          ? record.taskIds.filter((id) => id !== taskId)
          : [...record.taskIds, taskId],
      }
    })
  }

  const addLineItem = (type) => {
    upsertRecord(selectedEmployeeId, selectedPeriod, (record) => ({
      ...record,
      [type]: [...record[type], { id: uid(), label: '', amount: 0 }],
    }))
  }

  const updateLineItem = (type, itemId, key, value) => {
    upsertRecord(selectedEmployeeId, selectedPeriod, (record) => ({
      ...record,
      [type]: record[type].map((item) =>
        item.id === itemId
          ? {
              ...item,
              [key]: key === 'amount' ? parseAmount(value) : value,
            }
          : item,
      ),
    }))
  }

  const removeLineItem = (type, itemId) => {
    upsertRecord(selectedEmployeeId, selectedPeriod, (record) => ({
      ...record,
      [type]: record[type].filter((item) => item.id !== itemId),
    }))
  }

  const handleDeleteRecord = (recordId) => {
    const confirmed = window.confirm('确认删除这条工资记录吗？')
    if (!confirmed) {
      return
    }

    updateAppState((prev) => ({
      ...prev,
      payrollRecords: prev.payrollRecords.filter((record) => record.id !== recordId),
    }))
  }

  const switchToEmployeePayroll = (employeeId) => {
    setSelectedEmployeeId(employeeId)
    setSelectedPeriod(currentPeriod)
    setActiveTab('payroll')
  }

  const handleCurrentPeriodChange = (value) => {
    const previousPeriod = currentPeriod
    updateAppState((prev) => ({
      ...prev,
      currentPeriod: value,
    }))

    if (selectedPeriod === previousPeriod) {
      setSelectedPeriod(value)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <span className="eyebrow">手机端本地工资统计</span>
          <h1>员工工资统计</h1>
          <p className="hero-text">
            适合小型会计公司内部使用，员工、任务价目、工资核算与历史明细都可直接在手机上维护，修改后自动保存在本机。
          </p>
        </div>
        <div className="hero-tips">
          <div className="tip-pill">本地保存</div>
          <div className="tip-pill">支持反复编辑</div>
          <div className="tip-pill">按月查看记录</div>
        </div>
      </header>

      <nav className="tab-bar" aria-label="功能导航">
        {[
          ['overview', '总览'],
          ['employees', '员工'],
          ['tasks', '任务价目'],
          ['payroll', '工资核算'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>统计概览</h2>
                <p>切换当前期间后，总览和快捷入口会同步更新。</p>
              </div>
              <label className="compact-field">
                <span>当前期间</span>
                <input
                  type="month"
                  value={currentPeriod}
                  onChange={(event) => handleCurrentPeriodChange(event.target.value)}
                />
              </label>
            </div>

            <div className="stats-grid">
              <StatCard label="员工人数" value={`${overviewStats.employees} 人`} />
              <StatCard label="任务数量" value={`${overviewStats.tasks} 项`} />
              <StatCard label="当期工资合计" value={formatCurrency(overviewStats.currentPayroll)} />
              <StatCard label="累计工资合计" value={formatCurrency(overviewStats.cumulativePayroll)} />
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>员工工资速览</h2>
                <p>点击“去核算”可直接进入该员工当期工资编辑页。</p>
              </div>
            </div>

            {employeeSummaries.length ? (
              <div className="card-list">
                {employeeSummaries.map((employee) => (
                  <div key={employee.id} className="summary-card">
                    <div className="summary-main">
                      <div>
                        <h3>{employee.name}</h3>
                        <p>
                          {employee.role || '未填写岗位'}
                          {employee.salaryAccount ? ` · ${employee.salaryAccount}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => switchToEmployeePayroll(employee.id)}
                      >
                        去核算
                      </button>
                    </div>
                    <div className="summary-metrics">
                      <span>当期：{formatCurrency(employee.currentPayable)}</span>
                      <span>累计：{formatCurrency(employee.cumulativePayable)}</span>
                      <span>记录：{employee.recordCount} 条</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="还没有员工档案"
                description="先到“员工”页新增员工，再进入工资核算。"
              />
            )}
          </article>
        </section>
      )}

      {activeTab === 'employees' && (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>{editingEmployeeId ? '编辑员工' : '新增员工'}</h2>
                <p>每位员工都可绑定独立薪资账户，后续工资记录按人汇总。</p>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleEmployeeSubmit}>
              <label>
                <span>员工姓名</span>
                <input
                  required
                  value={employeeForm.name}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="例如：张会计"
                />
              </label>
              <label>
                <span>岗位</span>
                <input
                  value={employeeForm.role}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, role: event.target.value }))
                  }
                  placeholder="例如：外勤会计"
                />
              </label>
              <label>
                <span>薪资账户</span>
                <input
                  value={employeeForm.salaryAccount}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      salaryAccount: event.target.value,
                    }))
                  }
                  placeholder="银行卡 / 支付宝 / 微信等"
                />
              </label>
              <label>
                <span>联系电话</span>
                <input
                  value={employeeForm.phone}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="方便内部联系"
                />
              </label>
              <label className="full-width">
                <span>备注</span>
                <textarea
                  rows="3"
                  value={employeeForm.note}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="可记录开户信息、说明事项等"
                />
              </label>

              <div className="form-actions full-width">
                <button type="submit" className="primary-button">
                  {editingEmployeeId ? '保存员工信息' : '新增员工'}
                </button>
                {editingEmployeeId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setEditingEmployeeId('')
                      setEmployeeForm(emptyEmployeeForm)
                    }}
                  >
                    取消编辑
                  </button>
                )}
              </div>
            </form>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>员工档案</h2>
                <p>支持随时修改、删除，工资记录会自动关联到对应员工。</p>
              </div>
            </div>

            {employeeSummaries.length ? (
              <div className="card-list">
                {employeeSummaries.map((employee) => (
                  <div key={employee.id} className="summary-card">
                    <div className="summary-main">
                      <div>
                        <h3>{employee.name}</h3>
                        <p>{employee.role || '未填写岗位'}</p>
                      </div>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => switchToEmployeePayroll(employee.id)}
                        >
                          核算工资
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleEditEmployee(employee)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDeleteEmployee(employee.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="summary-metrics">
                      <span>账户：{employee.salaryAccount || '未填写'}</span>
                      <span>当期：{formatCurrency(employee.currentPayable)}</span>
                      <span>累计：{formatCurrency(employee.cumulativePayable)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="还没有员工"
                description="先新增员工档案，后续才能按员工核算工资。"
              />
            )}
          </article>
        </section>
      )}

      {activeTab === 'tasks' && (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>{editingTaskId ? '编辑任务价目' : '新增任务价目'}</h2>
                <p>任务库默认可自由修改，任务金额会直接参与工资自动累加。</p>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleTaskSubmit}>
              <label>
                <span>任务名称</span>
                <input
                  required
                  value={taskForm.name}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="例如：客户资料整理"
                />
              </label>
              <label>
                <span>固定金额</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={taskForm.amount}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  placeholder="输入金额"
                />
              </label>
              <label className="full-width">
                <span>备注</span>
                <textarea
                  rows="3"
                  value={taskForm.note}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="可填写适用场景或说明"
                />
              </label>
              <div className="form-actions full-width">
                <button type="submit" className="primary-button">
                  {editingTaskId ? '保存任务' : '新增任务'}
                </button>
                {editingTaskId && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setEditingTaskId('')
                      setTaskForm(emptyTaskForm)
                    }}
                  >
                    取消编辑
                  </button>
                )}
              </div>
            </form>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>任务薪资库</h2>
                <p>勾选已完成任务后，该任务金额会自动计入对应员工工资。</p>
              </div>
            </div>

            {tasks.length ? (
              <div className="card-list">
                {tasks.map((task) => {
                  const usedCount = payrollRecords.filter((record) =>
                    record.taskIds.includes(task.id),
                  ).length

                  return (
                    <div key={task.id} className="summary-card">
                      <div className="summary-main">
                        <div>
                          <h3>{task.name}</h3>
                          <p>{task.note || '无备注'}</p>
                        </div>
                        <div className="price-tag">{formatCurrency(task.amount)}</div>
                      </div>
                      <div className="summary-metrics">
                        <span>使用记录：{usedCount} 条</span>
                        <span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleEditTask(task)}
                          >
                            编辑
                          </button>
                        </span>
                        <span>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            删除
                          </button>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="暂无任务价目" description="新增任务后即可用于工资核算。" />
            )}
          </article>
        </section>
      )}

      {activeTab === 'payroll' && (
        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>工资核算</h2>
                <p>选择员工和期间后，可勾选任务、录入扣款，并直接调整工资。</p>
              </div>
            </div>

            <div className="selector-grid">
              <label>
                <span>员工</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                >
                  <option value="">请选择员工</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>工资期间</span>
                <input
                  type="month"
                  value={selectedPeriod}
                  onChange={(event) => setSelectedPeriod(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary-button align-end"
                onClick={() => setSelectedPeriod(currentPeriod)}
              >
                使用当前期间
              </button>
            </div>

            {selectedEmployee && currentEditableRecord ? (
              <>
                <div className="totals-board">
                  <StatCard label="任务工资" value={formatCurrency(currentTotals.taskTotal)} />
                  <StatCard label="扣款合计" value={formatCurrency(currentTotals.deductionTotal)} />
                  <StatCard label="补贴调整" value={formatCurrency(currentTotals.adjustmentTotal)} />
                  <StatCard label="直接调整" value={formatCurrency(currentTotals.directAdjustment)} />
                  <StatCard
                    label="实发工资"
                    value={formatCurrency(currentTotals.payable)}
                    highlight
                  />
                </div>

                <div className="panel-group">
                  <section className="sub-panel">
                    <div className="sub-panel-head">
                      <h3>已完成任务</h3>
                      <p>勾选后自动累加到当期工资。</p>
                    </div>

                    {tasks.length ? (
                      <div className="check-list">
                        {tasks.map((task) => (
                          <label key={task.id} className="check-item">
                            <input
                              type="checkbox"
                              checked={currentEditableRecord.taskIds.includes(task.id)}
                              onChange={() => handleTaskToggle(task.id)}
                            />
                            <div>
                              <strong>{task.name}</strong>
                              <span>{formatCurrency(task.amount)}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="暂无任务可选"
                        description="请先到“任务价目”页补充任务项目。"
                        compact
                      />
                    )}
                  </section>

                  <section className="sub-panel">
                    <div className="sub-panel-head">
                      <h3>扣款事项</h3>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => addLineItem('deductions')}
                      >
                        新增扣款
                      </button>
                    </div>
                    <LineItemsEditor
                      items={currentEditableRecord.deductions}
                      onChange={(itemId, key, value) =>
                        updateLineItem('deductions', itemId, key, value)
                      }
                      onRemove={(itemId) => removeLineItem('deductions', itemId)}
                      amountHint="扣款金额"
                      emptyText="暂无扣款事项"
                    />
                  </section>

                  <section className="sub-panel">
                    <div className="sub-panel-head">
                      <h3>补贴 / 调整</h3>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => addLineItem('adjustments')}
                      >
                        新增调整
                      </button>
                    </div>
                    <LineItemsEditor
                      items={currentEditableRecord.adjustments}
                      onChange={(itemId, key, value) =>
                        updateLineItem('adjustments', itemId, key, value)
                      }
                      onRemove={(itemId) => removeLineItem('adjustments', itemId)}
                      amountHint="正数补发，负数扣减"
                      emptyText="暂无补贴或调整"
                    />
                  </section>

                  <section className="sub-panel">
                    <div className="sub-panel-head">
                      <h3>直接调整工资</h3>
                      <p>适合临时改薪、补发或人工校正。</p>
                    </div>

                    <label>
                      <span>直接调整金额</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={currentEditableRecord.directAdjustment}
                        onChange={(event) =>
                          upsertRecord(selectedEmployeeId, selectedPeriod, (record) => ({
                            ...record,
                            directAdjustment: event.target.value,
                          }))
                        }
                        placeholder="可输入正数或负数"
                      />
                    </label>

                    <label>
                      <span>工资备注</span>
                      <textarea
                        rows="3"
                        value={currentEditableRecord.note}
                        onChange={(event) =>
                          upsertRecord(selectedEmployeeId, selectedPeriod, (record) => ({
                            ...record,
                            note: event.target.value,
                          }))
                        }
                        placeholder="记录补发原因、特殊说明等"
                      />
                    </label>
                  </section>
                </div>
              </>
            ) : (
              <EmptyState
                title="请先选择员工"
                description="如果还没有员工档案，请先到“员工”页新增。"
              />
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>工资记录</h2>
                <p>历史记录可随时切换到对应期间继续修改。</p>
              </div>
            </div>

            {selectedEmployeeRecords.length ? (
              <div className="card-list">
                {selectedEmployeeRecords.map((record) => {
                  const totals = getRecordTotals(record, tasks)

                  return (
                    <div key={record.id} className="summary-card">
                      <div className="summary-main">
                        <div>
                          <h3>{record.period}</h3>
                          <p>{record.note || '无备注'}</p>
                        </div>
                        <div className="price-tag">{formatCurrency(totals.payable)}</div>
                      </div>
                      <div className="summary-metrics">
                        <span>任务：{formatCurrency(totals.taskTotal)}</span>
                        <span>扣款：{formatCurrency(totals.deductionTotal)}</span>
                        <span>调整：{formatCurrency(totals.adjustmentTotal + totals.directAdjustment)}</span>
                      </div>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedPeriod(record.period)}
                        >
                          打开编辑
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          删除记录
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="暂无工资记录"
                description="在左侧选择员工并开始勾选任务后，会自动生成该期间记录。"
              />
            )}
          </article>
        </section>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight = false }) {
  return (
    <div className={`stat-card ${highlight ? 'highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ title, description, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function LineItemsEditor({ items, onChange, onRemove, amountHint, emptyText }) {
  if (!items.length) {
    return <div className="empty-line">{emptyText}</div>
  }

  return (
    <div className="line-items">
      {items.map((item) => (
        <div key={item.id} className="line-item">
          <input
            value={item.label}
            onChange={(event) => onChange(item.id, 'label', event.target.value)}
            placeholder="事项名称"
          />
          <input
            type="number"
            inputMode="decimal"
            value={item.amount}
            onChange={(event) => onChange(item.id, 'amount', event.target.value)}
            placeholder={amountHint}
          />
          <button type="button" className="danger-button" onClick={() => onRemove(item.id)}>
            删除
          </button>
        </div>
      ))}
    </div>
  )
}

export default App
