import React, { useState, useMemo } from 'react';
import { inlineFormat } from '../../utils/formatMessage.jsx';

export default function DataTable({ block }) {
  const { headers = [], rows = [], filterable } = block;
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [filterText, setFilterText] = useState('');

  const handleSort = (index) => {
    if (sortColumn === index) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortColumn(null); setSortDir(null); }
    } else {
      setSortColumn(index);
      setSortDir('asc');
    }
  };

  const processedRows = useMemo(() => {
    let result = [...rows];

    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(lower))
      );
    }

    if (sortColumn !== null && sortDir) {
      result.sort((a, b) => {
        const valA = a[sortColumn] ?? '';
        const valB = b[sortColumn] ?? '';
        const numA = Number(valA);
        const numB = Number(valB);
        let cmp;
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = String(valA).localeCompare(String(valB));
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [rows, filterText, sortColumn, sortDir]);

  const sortIndicator = (index) => {
    if (sortColumn !== index) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="sb-table-wrap">
      {filterable && (
        <div className="sb-table-controls">
          <input
            type="text"
            className="sb-table-filter"
            placeholder="Filtrar..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      )}
      <table className="sb-table">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="sb-table-sort"
                onClick={() => handleSort(i)}
              >
                <span dangerouslySetInnerHTML={{ __html: inlineFormat(String(header)) }} />{sortIndicator(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} dangerouslySetInnerHTML={{ __html: inlineFormat(String(cell)) }} />
              ))}
            </tr>
          ))}
          {processedRows.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                Sin resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
