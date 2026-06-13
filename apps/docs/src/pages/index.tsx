import { Redirect } from '@docusaurus/router'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext()
  return <Redirect to={`${siteConfig.baseUrl}docs`} />
}
