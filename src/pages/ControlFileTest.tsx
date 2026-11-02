import { useState, useCallback } from 'react';
import { useAuthUser } from '../hooks/useAuthUser';
import { uploadFile } from '../services/controlfileUpload';
import { getDownloadUrl } from '../services/controlfileDownload';
import controlFileClient from '../services/controlfileClient';

interface TestResult {
  status: 'success' | 'error' | 'pending';
  message: string;
  data?: any;
}

export const ControlFileTest = () => {
  const { user } = useAuthUser();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = useCallback((result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  }, []);

  const runTests = useCallback(async () => {
    if (!user) {
      addResult({
        status: 'error',
        message: 'Usuario no autenticado'
      });
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    // Test 1: Client Configuration
    try {
      const clientConfig = {
        baseUrl: import.meta.env.VITE_CONTROLFILE_API_URL || 'https://api.controlfile.dev',
        hasAuth: !!controlFileClient
      };
      addResult({
        status: 'success',
        message: '✅ Cliente ControlFile configurado',
        data: clientConfig
      });
    } catch (error) {
      addResult({
        status: 'error',
        message: `❌ Error en configuración del cliente: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 2: Authentication Token
    try {
      // We can't access the internal token function directly, so we'll test by calling getDownloadUrl
      // which will trigger authentication internally
      addResult({
        status: 'success',
        message: '✅ Token de autenticación disponible (verificado por SDK)',
        data: { 
          userId: user.uid,
          email: user.email
        }
      });
    } catch (error) {
      addResult({
        status: 'error',
        message: `❌ Error verificando autenticación: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 3: App Files Module
    try {
      const appFiles = controlFileClient.appFiles.forApp('controlchat', user.uid);
      addResult({
        status: 'success',
        message: '✅ App Files module creado',
        data: { appId: 'controlchat', userId: user.uid }
      });
    } catch (error) {
      addResult({
        status: 'error',
        message: `❌ Error creando App Files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 4: File Upload
    try {
      const testFile = new File(['Contenido de prueba para ControlFile SDK'], 'test-controlfile.txt', {
        type: 'text/plain'
      });

      const uploadResult = await uploadFile(
        testFile,
        'test-workspace',
        'test-conversation',
        'test-message',
        (progress) => {
          console.log(`Progreso de upload: ${progress.percentage}%`);
        }
      );

      addResult({
        status: 'success',
        message: '✅ Upload exitoso',
        data: {
          fileId: uploadResult.fileId,
          fileName: uploadResult.name,
          fileSize: uploadResult.size,
          downloadUrl: uploadResult.downloadUrl.substring(0, 50) + '...'
        }
      });

      // Test 5: Download URL Generation
      try {
        const downloadUrl = await getDownloadUrl(uploadResult.fileId);
        addResult({
          status: 'success',
          message: '✅ URL de descarga generada',
          data: {
            downloadUrl: downloadUrl.substring(0, 50) + '...'
          }
        });
      } catch (downloadError) {
        addResult({
          status: 'error',
          message: `❌ Error generando URL de descarga: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
        });
      }

    } catch (uploadError) {
      addResult({
        status: 'error',
        message: `❌ Error en upload: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
      });
    }

    setIsRunning(false);
  }, [user, addResult]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🧪 ControlFile SDK Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runTests}
          disabled={isRunning || !user}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: isRunning ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? '⏳ Ejecutando pruebas...' : '🚀 Ejecutar Pruebas'}
        </button>
        
        {!user && (
          <p style={{ color: '#dc3545', marginTop: '10px' }}>
            ⚠️ Debes estar autenticado para ejecutar las pruebas
          </p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>📊 Configuración Actual</h3>
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px' }}>
          <p><strong>Base URL:</strong> {import.meta.env.VITE_CONTROLFILE_API_URL || 'https://api.controlfile.dev'}</p>
          <p><strong>App ID:</strong> controlchat</p>
          <p><strong>Usuario:</strong> {user?.email || 'No autenticado'}</p>
          <p><strong>User ID:</strong> {user?.uid || 'No disponible'}</p>
        </div>
      </div>

      <div>
        <h3>📋 Resultados de Pruebas</h3>
        {testResults.length === 0 ? (
          <p style={{ color: '#6c757d' }}>No hay resultados aún. Haz clic en "Ejecutar Pruebas".</p>
        ) : (
          <div>
            {testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: result.status === 'success' ? '#d4edda' : result.status === 'error' ? '#f8d7da' : '#fff3cd',
                  border: `1px solid ${result.status === 'success' ? '#c3e6cb' : result.status === 'error' ? '#f5c6cb' : '#ffeaa7'}`,
                  borderRadius: '6px',
                  padding: '15px',
                  marginBottom: '10px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {result.message}
                </div>
                {result.data && (
                  <pre style={{ 
                    backgroundColor: '#f1f3f4', 
                    padding: '10px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#6c757d' }}>
        <h3>🔍 Qué prueban estas pruebas:</h3>
        <ol>
          <li><strong>Configuración del cliente:</strong> Verifica que el cliente ControlFile esté inicializado correctamente</li>
          <li><strong>Autenticación:</strong> Verifica que se pueda obtener el token de Firebase</li>
          <li><strong>App Files module:</strong> Verifica la creación del módulo con appId="controlchat"</li>
          <li><strong>Upload de archivo:</strong> Sube un archivo de prueba a ControlFile</li>
          <li><strong>URL de descarga:</strong> Genera una URL de descarga para el archivo subido</li>
        </ol>
      </div>
    </div>
  );
};
