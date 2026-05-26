'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewOrderPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/orders?action=new') }, [router])
  return null
}
