//src/app/(dashboard)/dashboard/finance/payouts/page.tsx
"use client";

import { useEffect, useState } from "react";

type Employee = {
  employeeId: string;
  name: string | null;
  balance: number;
};

type EmployeesResponse = {
  ok?: boolean;
  items?: Employee[];
};

export default function FinancePayoutsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");

  async function loadEmployees() {
    const res = await fetch("/api/finance/employees", {
      cache: "no-store",
    });

    const json = (await res.json()) as EmployeesResponse;

    if (json.ok && json.items) {
      setEmployees(json.items);
    }
  }

  async function createPayout() {
    if (!employeeId || !amount) return;

    await fetch("/api/finance/payouts", {
      method: "POST",
      body: JSON.stringify({
        employeeId,
        amount: Number(amount),
      }),
    });

    setAmount("");
    loadEmployees();
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">صرف المستحقات</h1>

      <div className="border rounded p-4 space-y-4">
        <select
          className="border rounded px-3 py-2 w-full"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">اختر الموظف</option>

          {employees.map((emp) => (
            <option key={emp.employeeId} value={emp.employeeId}>
              {emp.name} - الرصيد {emp.balance}
            </option>
          ))}
        </select>

        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="المبلغ"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={createPayout}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          صرف
        </button>
      </div>

      <div className="border rounded">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="p-3">الموظف</th>
              <th>الرصيد</th>
            </tr>
          </thead>

          <tbody>
            {employees.map((emp) => (
              <tr key={emp.employeeId} className="border-t">
                <td className="p-3">{emp.name}</td>
                <td>{emp.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
