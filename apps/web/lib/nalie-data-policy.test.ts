import { describe, expect, it } from 'vitest';
import {
  appendNaliePolicyToCsv,
  buildNaliePolicyLines,
  createProtectedExcelBuffer,
  createProtectedMultiSheetExcelBuffer,
} from './nalie-data-policy';

describe('Nalie data policy', () => {
  it('appends the protected-content policy after clean CSV data', () => {
    const output = appendNaliePolicyToCsv(
      '\uFEFFCliente;Valor\r\nEmpresa;100',
      {
        clientName: 'Empresa Exemplo',
        clientId: 'CLI-0001',
        processingId: 'PROC-0001',
        source: 'Compilado do portal',
      },
    );

    expect(output).toContain('Empresa;100\r\n\r\n# NALIE_DATA_POLICY\r\n');
    expect(output).toContain('# Cliente: Empresa Exemplo');
    expect(output).toContain('# ID do cliente: CLI-0001');
    expect(output).toContain('# Processamento ID: PROC-0001');
    expect(output).toContain('# Origem do processamento: Compilado do portal');
    expect(output.trimEnd().endsWith('# FIM_NALIE_DATA_POLICY')).toBe(true);
  });

  it('does not create unavailable client identifiers', () => {
    const lines = buildNaliePolicyLines();
    expect(lines.some((line) => line.startsWith('Cliente:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('ID do cliente:'))).toBe(false);
  });

  it('stores the policy in a very hidden Excel sheet without adding policy rows to the data', async () => {
    const ExcelJS = await import('exceljs');
    const buffer = await createProtectedExcelBuffer({
      sheetName: 'Dados',
      headers: ['Cliente', 'Valor'],
      rows: [['Empresa Exemplo', 100]],
      context: { clientId: 'CLI-0001' },
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    const dataSheet = workbook.getWorksheet('Dados');
    const policySheet = workbook.getWorksheet('_NALIE_DATA_POLICY');
    expect(dataSheet?.rowCount).toBe(2);
    expect(dataSheet?.getCell('A2').value).toBe('Empresa Exemplo');
    expect(policySheet?.state).toBe('veryHidden');
    expect(policySheet?.getColumn(2).values.join(' ')).toContain('CLI-0001');
    expect(policySheet?.getCell('A2').font.color).toEqual({
      argb: 'FFFFFFFF',
    });
    expect(policySheet?.getCell('A2').fill).toMatchObject({
      type: 'pattern',
      fgColor: { argb: 'FFFFFFFF' },
    });
  });

  it('creates the final financial workbook with three data sheets and one protected policy sheet', async () => {
    const ExcelJS = await import('exceljs');
    const buffer = await createProtectedMultiSheetExcelBuffer({
      context: { clientId: 'USR000001', clientName: 'Empresa Teste' },
      sheets: [
        {
          sheetName: 'Movimentações da conta',
          headers: ['valor'],
          rows: [[100]],
        },
        {
          sheetName: 'Lançamentos do cartão',
          headers: ['valor_brl'],
          rows: [[50]],
        },
        { sheetName: 'Parcelas futuras', headers: ['valor_brl'], rows: [[25]] },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    expect(
      workbook.getWorksheet('Movimentações da conta')?.getCell('A2').value,
    ).toBe(100);
    expect(
      workbook.getWorksheet('Lançamentos do cartão')?.getCell('A2').value,
    ).toBe(50);
    expect(workbook.getWorksheet('Parcelas futuras')?.getCell('A2').value).toBe(
      25,
    );
    expect(workbook.getWorksheet('_NALIE_DATA_POLICY')?.state).toBe(
      'veryHidden',
    );
  });
});
