import React, { useState } from 'react';
import { X, Loader2, Brain, Zap } from 'lucide-react';

interface AnalyzeAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentation: string;
  onAnalyze: (provider: 'openai' | 'groq' | 'auto', result: string) => void;
}

export const AnalyzeAIModal: React.FC<AnalyzeAIModalProps> = ({
  isOpen,
  onClose,
  documentation,
  onAnalyze,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'groq' | 'auto'>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      // Simular análisis con IA
      const prompt = `Analiza la siguiente documentación del proyecto y proporciona:
1. Resumen ejecutivo (máximo 3 líneas)
2. Dependencias técnicas identificadas
3. Riesgos potenciales
4. Recomendaciones de priorización

Documentación:
${documentation}`;

      // En implementación real, se enviaría a la IA seleccionada
      const result = `
✓ Análisis completado con ${selectedProvider === 'auto' ? 'proveedor automático' : selectedProvider}

RESUMEN EJECUTIVO:
- Sistema SVP implementado con arquitectura de outbox pattern
- Integración multi-aplicación con manejo robusto de fallos
- Operaciones avanzadas de monitoreo y conciliación

DEPENDENCIAS TÉCNICAS:
- PostgreSQL (Neon) para persistencia
- Upstash Redis para rate limiting distribuido
- API Gateway de Vercel para enrutamiento
- React 19 + TypeScript para frontend

RIESGOS IDENTIFICADOS:
- Rendimiento con ledgers > 100k registros (p99 latencia)
- Consistencia eventual en dead-letter replay
- Alertas falsas por picos temporales de carga

RECOMENDACIONES:
1. Implementar índices en tablas de alta rotación
2. Agregar Circuit Breaker para llamadas a servicios externos
3. Aumentar threshold de alertas en horas de pico
4. Realizar pruebas de carga regulares (semanal)
      `;

      setAnalysisResult(result);
      onAnalyze(selectedProvider, result);
    } catch (error) {
      console.error('[v0] Error analizando:', error);
      setAnalysisResult('Error al realizar análisis. Por favor intenta de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 bg-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Analizar con IA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!analysisResult ? (
            <>
              {/* Provider Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">
                  Selecciona proveedor de IA o usa automático:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'auto', label: 'Automático (más rápido)', icon: <Zap className="w-4 h-4" /> },
                    { id: 'openai', label: 'OpenAI (más preciso)', icon: <Brain className="w-4 h-4" /> },
                    { id: 'groq', label: 'Groq (tiempo real)', icon: <Zap className="w-4 h-4" /> },
                  ].map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider.id as any)}
                      className={`p-3 rounded-lg border-2 transition flex items-center gap-2 text-left ${
                        selectedProvider === provider.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {provider.icon}
                      <span className="font-medium text-slate-900">{provider.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Documentation Preview */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900">
                  Documentación a analizar:
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto text-xs text-slate-600">
                  {documentation.substring(0, 300)}...
                </div>
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Analizar IA
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">Resultado del Análisis:</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 whitespace-pre-wrap text-sm text-slate-700 font-mono">
                  {analysisResult}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(analysisResult);
                    alert('Análisis copiado al portapapeles');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setAnalysisResult('')}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Nuevo Análisis
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
