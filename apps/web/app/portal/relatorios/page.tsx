'use client';

import { useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import FileImportButton from '../../components/file-import-button';
import CompanySwitcher from '../../components/company-switcher';
import {
  appendNaliePolicyToCsv,
  createProtectedExcelBuffer,
  createProtectedMultiSheetExcelBuffer,
} from '../../../lib/nalie-data-policy';
import { createClient } from '../../../lib/supabase/client';

const reports = [
  {
    icon: '🏦',
    title: 'Dados financeiros enviados',
    description: 'Extratos e bases financeiras recebidos da empresa.',
    sources: 'Arquivos enviados pelo cliente e dados tratados pela Nalie',
    coverage: 'Nome do arquivo, formato, responsável e data de envio',
  },
  {
    icon: '🛒',
    title: 'Dados comerciais enviados',
    description: 'Arquivos comerciais guardados pela empresa.',
    sources: 'Planilhas, relatórios de PDV e bases fornecidas pelo cliente',
    coverage: 'Período, produto ou serviço, quantidade, receita e canal',
  },
  {
    icon: '📁',
    title: 'Arquivos e documentos enviados',
    description: 'Relação dos documentos disponibilizados para a assessoria.',
    sources: 'Uploads realizados no portal e referências recebidas pela Nalie',
    coverage: 'Nome, formato, data de envio e situação do armazenamento',
  },
];

type ImportedFile = {
  id: string;
  name: string;
  companyId: string;
  userId?: string;
  company: string;
  person: string;
  date: string;
  status: string;
  storagePath?: string;
  byteSize?: number;
  checksumSha256?: string;
  importIdentifier: string;
};

const MAX_DIRECT_EXPORT_BYTES = 20 * 1024 * 1024;
const LARGE_FILE_MESSAGE = 'Arquivo extenso. Contacte o seu consultor.';

type FinancialExportRecord = Record<string, string | number | null>;
type ConsolidatedExport = {
  ok: boolean;
  message?: string;
  total_rows: number;
  movimentacoes_conta: FinancialExportRecord[];
  cartao_lancamentos: FinancialExportRecord[];
  cartao_parcelas_futuras: FinancialExportRecord[];
};

const consolidatedColumns = {
  movimentacoes_conta: [
    'banco_origem',
    'conta_final',
    'data_movimentacao',
    'descricao_original',
    'contraparte',
    'tipo_operacao',
    'direcao',
    'valor',
    'categoria',
    'subcategoria',
    'arquivo_origem',
    'id_operacao_banco',
  ],
  cartao_lancamentos: [
    'banco_origem',
    'cartao_final',
    'produto_cartao',
    'data_compra',
    'descricao_original',
    'contraparte',
    'valor_brl',
    'valor_usd',
    'cotacao_dolar',
    'iof',
    'categoria',
    'subcategoria',
    'categoria_banco',
    'parcela_atual',
    'parcelas_total',
    'tipo_lancamento',
    'competencia_fatura',
    'data_fechamento',
    'data_vencimento',
    'arquivo_origem',
  ],
  cartao_parcelas_futuras: [
    'banco_origem',
    'cartao_final',
    'data_prevista',
    'descricao_original',
    'contraparte',
    'valor_brl',
    'categoria',
    'subcategoria',
    'parcela_atual',
    'parcelas_total',
    'status_parcela',
    'arquivo_origem',
  ],
} as const;

function financialRows(
  records: FinancialExportRecord[],
  columns: readonly string[],
) {
  return records.map((record) =>
    columns.map((column) => {
      const value = record[column];
      if (value === null || value === undefined) return '';
      if (column.startsWith('data_') && typeof value === 'string') {
        return new Date(`${value}T00:00:00Z`);
      }
      return value;
    }),
  );
}

const seedImportedFiles: ImportedFile[] = [];

export default function ReportsPage() {
  const [notice, setNotice] = useState('');
  const [importedClientFilter, setImportedClientFilter] = useState('Todos');
  const [importedFiles, setImportedFiles] = useState(seedImportedFiles);
  const [clientDataKey, setClientDataKey] = useState('Não selecionado');
  const [companyName, setCompanyName] = useState('Empresa não selecionada');
  const [companyImportIdentifier, setCompanyImportIdentifier] =
    useState('Não selecionado');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const visibleImportedFiles = importedFiles.filter(
    (file) =>
      importedClientFilter === 'Todos' || file.person === importedClientFilter,
  );
  const latestStoredDate = importedFiles[0]?.date ?? 'Aguardando arquivos';

  useEffect(() => {
    async function loadAdministrativeCompanies() {
      try {
        const supabase = createClient();
        const { data: administrator } = await supabase.rpc('is_super_admin');
        if (!administrator) return;
        setIsAdministrator(true);
        const { data } = await supabase
          .from('companies')
          .select('id,display_name')
          .eq('status', 'ACTIVE')
          .order('display_name');
        const companiesWithLogin = await Promise.all(
          (data ?? []).map(async (company) => {
            const { data: hasCompletedLogin } = await supabase.rpc(
              'company_has_completed_login',
              { target_company_id: company.id },
            );
            return hasCompletedLogin ? company : null;
          }),
        );
        setCompanyOptions(
          companiesWithLogin
            .filter((company) => company !== null)
            .map((company) => ({
              id: String(company.id),
              name: String(company.display_name),
            })),
        );
      } catch {
        setCompanyOptions([]);
      }
    }
    void loadAdministrativeCompanies();
  }, []);

  useEffect(() => {
    async function loadStoredFiles() {
      try {
        const query = selectedCompanyId
          ? `?companyId=${encodeURIComponent(selectedCompanyId)}`
          : '';
        const response = await fetch(`/api/admin/company-files${query}`);
        const result = (await response.json()) as {
          error?: string;
          companyId?: string;
          companyName?: string;
          importIdentifier?: string;
          uploaders?: Record<string, string>;
          documents?: Array<{
            id: string;
            file_name: string;
            storage_path: string;
            uploaded_by: string | null;
            created_at: string;
            byte_size: number | null;
            checksum_sha256: string | null;
            storage_status: string;
          }>;
        };
        if (!response.ok) throw new Error(result.error);
        if (!result.companyId) {
          setImportedFiles([]);
          return;
        }
        const companyId = result.companyId;
        const companyName = result.companyName ?? 'Empresa do cliente';
        const importIdentifier = result.importIdentifier ?? companyId;
        setClientDataKey(importIdentifier);
        setSelectedCompanyId(companyId);
        setCompanyName(companyName);
        setCompanyImportIdentifier(importIdentifier);
        setImportedFiles(
          (result.documents ?? []).map((document) => ({
            id: document.id,
            name: document.file_name,
            companyId,
            userId: document.uploaded_by ?? undefined,
            company: companyName,
            person:
              result.uploaders?.[document.uploaded_by ?? ''] ??
              'Usuário da empresa',
            date: new Date(document.created_at).toLocaleDateString('pt-BR'),
            status:
              document.storage_status === 'ARCHIVED'
                ? 'Arquivado pela administração'
                : 'Armazenado · íntegro',
            storagePath: document.storage_path,
            byteSize: document.byte_size ?? undefined,
            checksumSha256: document.checksum_sha256 ?? undefined,
            importIdentifier,
          })),
        );
      } catch {
        setImportedFiles([]);
      }
    }
    void loadStoredFiles();
  }, [selectedCompanyId]);

  async function storeImportedFile(file: File) {
    try {
      if (isAdministrator && !selectedCompanyId)
        throw new Error('Selecione a empresa que receberá o arquivo.');
      const body = new FormData();
      if (selectedCompanyId) body.set('companyId', selectedCompanyId);
      body.set('file', file);
      const response = await fetch('/api/admin/company-files', {
        method: 'POST',
        body,
      });
      const responseText = await response.text();
      let result: {
        error?: string;
        id?: string;
        companyId?: string;
        storagePath?: string;
        checksum?: string;
        createdAt?: string;
        companyName?: string;
        importIdentifier?: string;
      } = {};
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        if (!response.ok)
          throw new Error(
            response.status === 413
              ? 'O PDF excede o limite permitido de 50 MB.'
              : `O servidor recusou o arquivo (erro ${response.status}).`,
          );
      }
      if (!response.ok || !result.id)
        throw new Error(result.error || 'O servidor não confirmou o arquivo.');

      const { data: authData } = await createClient().auth.getUser();
      const companyId = result.companyId || selectedCompanyId;
      if (!companyId)
        throw new Error('A empresa do arquivo não foi confirmada.');
      setImportedFiles((current) => [
        {
          id: result.id!,
          name: file.name,
          companyId,
          userId: authData.user?.id,
          company: result.companyName ?? companyName,
          person:
            authData.user?.user_metadata?.full_name ??
            authData.user?.email ??
            'Usuário da empresa',
          date: new Date(result.createdAt ?? Date.now()).toLocaleDateString(
            'pt-BR',
          ),
          status: 'Armazenado · íntegro',
          storagePath: result.storagePath,
          byteSize: file.size,
          checksumSha256: result.checksum,
          importIdentifier: result.importIdentifier ?? companyImportIdentifier,
        },
        ...current,
      ]);
      setNotice(`${file.name} armazenado com segurança, sem tratamento.`);
    } catch (error) {
      setNotice(
        `Não foi possível armazenar ${file.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}. Nenhum registro incompleto foi mantido.`,
      );
    }
  }

  function companyTaggedFilename(file: ImportedFile) {
    const safeCompanyId = file.companyId.replace(/[^a-zA-Z0-9-]/g, '-');
    return `empresa-${safeCompanyId}__${file.name}`;
  }

  async function downloadImportedFile(file: ImportedFile) {
    const downloadName = companyTaggedFilename(file);
    if ((file.byteSize ?? 0) > MAX_DIRECT_EXPORT_BYTES) {
      setNotice(LARGE_FILE_MESSAGE);
      return;
    }
    const txt = [
      `id_usuario=${file.importIdentifier}`,
      `nome=${file.company}`,
      '',
    ].join('\r\n');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    if (file.storagePath) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from('company-files')
          .createSignedUrl(file.storagePath, 60);
        if (error || !data?.signedUrl) throw error;
        const response = await fetch(data.signedUrl);
        if (!response.ok)
          throw new Error('Falha ao recuperar arquivo privado.');
        const sourceBlob = await response.blob();
        if (sourceBlob.size > MAX_DIRECT_EXPORT_BYTES) {
          setNotice(LARGE_FILE_MESSAGE);
          return;
        }
        zip.file(file.name, sourceBlob);
        zip.file(`usuario_${file.importIdentifier}.txt`, txt);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(zipBlob);
        link.href = url;
        link.download = `${downloadName}.zip`;
        link.rel = 'noopener';
        link.click();
        URL.revokeObjectURL(url);
        setNotice(
          `${downloadName}.zip gerado com o arquivo original e o TXT do cliente.`,
        );
        return;
      } catch {
        setNotice(`Não foi possível baixar ${file.name}. Tente novamente.`);
        return;
      }
    }

    const context = {
      clientName: file.company,
      clientId: clientDataKey,
      processingId: `NALIE-IMPORT-${file.date.replaceAll('/', '')}`,
      source: `Arquivo importado por ${file.person}`,
    };

    if (file.name.endsWith('.csv')) {
      const csv = [
        'arquivo;id_empresa;empresa;responsavel;data;situacao',
        `${file.name};${file.companyId};${file.company};${file.person};${file.date};${file.status}`,
      ].join('\r\n');
      zip.file(downloadName, appendNaliePolicyToCsv(csv, context));
    } else {
      const excel = await createProtectedExcelBuffer({
        sheetName: 'Arquivo importado',
        headers: [
          'Arquivo',
          'ID da empresa',
          'Empresa',
          'Responsável',
          'Data',
          'Situação',
        ],
        rows: [
          [
            file.name,
            file.companyId,
            file.company,
            file.person,
            file.date,
            file.status,
          ],
        ],
        context,
      });
      zip.file(downloadName, excel);
    }
    zip.file(`usuario_${file.importIdentifier}.txt`, txt);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.download = `${downloadName}.zip`;
    zipLink.click();
    URL.revokeObjectURL(zipUrl);
    setNotice(`${downloadName}.zip baixado com o TXT de identificação.`);
  }
  async function downloadConsolidatedReport() {
    if (!selectedCompanyId) {
      setNotice('Nenhuma empresa disponível para exportação.');
      return;
    }
    setNotice('Preparando o Compilado…');
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const { data, error } = await supabase.rpc(
        'financial_consolidated_export',
        { target_company_id: selectedCompanyId },
      );
      if (error) throw error;
      const result = data as ConsolidatedExport | null;
      if (!result?.ok) {
        setNotice(result?.message ?? 'Não foi possível gerar o Compilado.');
        return;
      }
      const processingId = `NALIE-COMPILADO-${crypto.randomUUID()}`;
      const excel = await createProtectedMultiSheetExcelBuffer({
        context: {
          clientName: companyName,
          clientId: companyImportIdentifier,
          processingId,
          source: 'Três tabelas financeiras oficiais do portal',
        },
        sheets: [
          {
            sheetName: 'Movimentações da conta',
            headers: [...consolidatedColumns.movimentacoes_conta],
            rows: financialRows(
              result.movimentacoes_conta ?? [],
              consolidatedColumns.movimentacoes_conta,
            ),
          },
          {
            sheetName: 'Lançamentos do cartão',
            headers: [...consolidatedColumns.cartao_lancamentos],
            rows: financialRows(
              result.cartao_lancamentos ?? [],
              consolidatedColumns.cartao_lancamentos,
            ),
          },
          {
            sheetName: 'Parcelas futuras',
            headers: [...consolidatedColumns.cartao_parcelas_futuras],
            rows: financialRows(
              result.cartao_parcelas_futuras ?? [],
              consolidatedColumns.cartao_parcelas_futuras,
            ),
          },
        ],
      });
      const txt = [
        `id_usuario=${companyImportIdentifier}`,
        `nome=${companyName}`,
        '',
      ].join('\r\n');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const safeIdentifier = companyImportIdentifier.replace(
        /[^A-Za-z0-9_-]/g,
        '-',
      );
      zip.file(`compilado_${safeIdentifier}.xlsx`, excel);
      zip.file(`usuario_${safeIdentifier}.txt`, txt);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      if (zipBlob.size > MAX_DIRECT_EXPORT_BYTES) {
        setNotice(LARGE_FILE_MESSAGE);
        return;
      }
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nalie_compilado_${safeIdentifier}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      const { data: user } = await supabase.auth.getUser();
      await supabase.from('report_exports').insert({
        company_id: selectedCompanyId,
        report_type: 'FINANCIAL_CONSOLIDATED',
        format: 'ZIP_XLSX_TXT',
        requested_by: user.user?.id ?? null,
        status: 'completed',
      });
      setNotice(
        `Compilado exportado com ${result.total_rows} registros e TXT de identificação.`,
      );
    } catch {
      setNotice('Não foi possível gerar o Compilado. Tente novamente.');
    }
  }
  return (
    <main className={shell.portal}>
      <aside className={shell.sidebar}>
        <MenuToggle />
        <div className={shell.brand}>
          <span>N</span>
          <div>
            <b>NALIE</b>
            <small>BUSINESS INTELLIGENCE</small>
          </div>
        </div>
        <CompanySwitcher className={shell.company} />
        <PortalNavigation />
        <AccessLegend />
      </aside>
      <section className={`${shell.content} ${styles.content}`}>
        <header>
          <div>
            <h1>Importação e exportação</h1>
            <p>
              Guarde arquivos da sua empresa e exporte os dados disponíveis.
            </p>
          </div>
        </header>
        {notice && (
          <div className={styles.notice} role="status">
            ✓ {notice}
          </div>
        )}
        <section className={styles.highlight}>
          <div>
            <span>ENTRADA DE DADOS</span>
            <h2>Envie seus arquivos para a Nalie</h2>
            <p>
              Aceitamos PDF, extratos, planilhas e documentos. Os arquivos são
              somente armazenados, sem leitura, tratamento ou conversão.
            </p>
          </div>
          {isAdministrator && (
            <label>
              Empresa de destino
              <select
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                <option value="">Selecione a empresa</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <FileImportButton
            disabled={isAdministrator && !selectedCompanyId}
            className={styles.primaryLink}
            label="＋ Importar arquivo"
            onFile={(file) => void storeImportedFile(file)}
          />
        </section>
        <section className={styles.grid}>
          {reports.map((report) => (
            <article key={report.title}>
              <span>{report.icon}</span>
              <div>
                <h2>{report.title}</h2>
                <p>{report.description}</p>
                <dl className={styles.provenance}>
                  <div>
                    <dt>Atualização</dt>
                    <dd>{latestStoredDate}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </section>
        <section className={`${styles.history} ${styles.importedHistory}`}>
          <div className={styles.title}>
            <div>
              <b>Arquivos importados pelos clientes</b>
              <small>
                Consulte quem enviou, a empresa, a data e a situação do
                armazenamento.
              </small>
            </div>
            <label className={styles.clientFilter}>
              Pessoa / cliente
              <select
                aria-label="Filtrar arquivos por pessoa"
                value={importedClientFilter}
                onChange={(event) =>
                  setImportedClientFilter(event.target.value)
                }
              >
                <option value="Todos">Todos os clientes</option>
                {importedFiles
                  .filter(
                    (file, index, files) =>
                      files.findIndex((item) => item.person === file.person) ===
                      index,
                  )
                  .map((file) => (
                    <option value={file.person} key={file.person}>
                      {file.person} · {file.company}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className={styles.importedFileScroller}>
            {visibleImportedFiles.map((file) => (
              <div className={styles.row} key={file.id}>
                <b>{file.name}</b>
                <span>
                  {file.company} · ID {file.companyId} · {file.person}
                </span>
                <span>{file.date}</span>
                <span
                  title={
                    file.checksumSha256
                      ? `SHA-256: ${file.checksumSha256}`
                      : undefined
                  }
                >
                  {file.status}
                  {file.byteSize !== undefined
                    ? ` · ${(file.byteSize / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
                    : ''}
                </span>
                <button
                  className={styles.downloadButton}
                  onClick={() => downloadImportedFile(file)}
                  aria-label={`Baixar ${file.name}`}
                >
                  Baixar ↓
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.highlight}>
          <div>
            <span>EXPORTAÇÃO ÚNICA</span>
            <h2>Compilado completo da empresa</h2>
            <p>
              Um único ZIP reúne as três bases financeiras em um Excel e o TXT
              de identificação da empresa.
            </p>
            <p>
              <b>Chave única do cliente:</b> {companyImportIdentifier}
            </p>
          </div>
          <button
            className={styles.primaryLink}
            onClick={downloadConsolidatedReport}
          >
            Exportar compilado completo ↓
          </button>
        </section>
        <section className={styles.history}>
          <div className={styles.title}>
            <div>
              <b>Relatórios recentes</b>
              <small>Downloads e gerações ficam registrados.</small>
            </div>
            <button>Ver auditoria</button>
          </div>
          <p>Nenhum relatório foi gerado ainda.</p>
        </section>
      </section>
    </main>
  );
}
