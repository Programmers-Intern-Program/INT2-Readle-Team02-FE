import { useQuery } from '@tanstack/react-query'
import { getResultReportDetail } from '@/shared/api/report'
import type { ResultReport } from '@/pages/result-report/model/resultReport'
import type { ApiError } from '@/shared/api/error'
import { isPositiveIntegerId } from '@/shared/utils/id'

export function useResultReportDetail(reportId: string) {
  return useQuery<ResultReport, ApiError>({
    queryKey: ['result-report', reportId],
    queryFn: () => getResultReportDetail(reportId),
    enabled: isPositiveIntegerId(reportId),
    staleTime: 5 * 60 * 1000, // 5분
  })
}
