'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewInventoryPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventory?action=new') }, [router])
  return null
}
